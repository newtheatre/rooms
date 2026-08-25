/**
 * The one path by which a booking's space or window changes. Every write
 * re-checks occupancy, so a route cannot forget it (CLAUDE.md invariant 4).
 */

import { db, schema } from '@nuxthub/db'
import { and, eq, gt, inArray, lt, ne, notExists, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { Booking } from '~~/server/db/schema/booking'
import { validateBookingAvailability } from './availability'

type BookingStatus = Booking['status']

/** Absent means "leave alone"; null clears the column. */
export interface BookingPatch {
  roomId?: number | null
  externalVenueId?: number | null
  startTime?: Date
  endTime?: Date
  status?: BookingStatus
  rejectionReason?: string | null
  eventTitle?: string
  numberOfAttendees?: number | null
  notes?: string | null
}

/** A space is held by these, so a booking leaving them frees its slot. */
const OCCUPYING: BookingStatus[] = ['CONFIRMED', 'PENDING', 'AWAITING_EXTERNAL']

/** Once here a booking is finished with; reviving one re-takes a released slot. */
const TERMINAL: BookingStatus[] = ['REJECTED', 'CANCELLED']

/** Assigning one space clears the other: a booking is never in both. */
function resolveSpace(existing: Booking, patch: BookingPatch) {
  if (patch.roomId !== undefined) return { roomId: patch.roomId, externalVenueId: null }
  if (patch.externalVenueId !== undefined) return { roomId: null, externalVenueId: patch.externalVenueId }
  return { roomId: existing.roomId, externalVenueId: existing.externalVenueId }
}

/** The same rows availability.ts counts, read from inside the write statement. */
const clash = alias(schema.bookings, 'clash')

/**
 * The occupancy rule as a predicate on the write itself. D1 has no interactive
 * transaction, so a SELECT alone cannot hold the slot (ADR-0008).
 */
function spaceStillFree(
  existingId: number,
  roomId: number | null,
  externalVenueId: number | null,
  startTime: Date,
  endTime: Date
): SQL | undefined {
  const space = roomId
    ? eq(clash.roomId, roomId)
    : externalVenueId
      ? eq(clash.externalVenueId, externalVenueId)
      : undefined

  if (!space) return undefined

  return notExists(db
    .select({ held: sql`1` })
    .from(clash)
    .where(and(
      space,
      ne(clash.id, existingId),
      inArray(clash.status, OCCUPYING),
      lt(clash.startTime, endTime),
      gt(clash.endTime, startTime)
    )))
}

/** The write a patch resolves to. `where` carries the occupancy re-check. */
export interface PlannedBookingWrite {
  changes: Record<string, unknown>
  where: SQL
}

/**
 * Throws 409 if the patch would double-book, unless `allowConflicts`.
 * Returns the row as written.
 */
export async function applyBookingChange(
  existing: Booking,
  patch: BookingPatch,
  options: { allowConflicts?: boolean } = {}
): Promise<void> {
  const { changes, where } = await planBookingChange(existing, patch, options)

  const written = await db
    .update(schema.bookings)
    .set(changes)
    .where(where)
    .returning({ id: schema.bookings.id })

  if (!written.length) await refuseBlockedBookingWrite(existing, patch)
}

/**
 * Why a guarded write matched nothing: the row went, or a clash landed between
 * the check and the write.
 */
export async function refuseBlockedBookingWrite(existing: Booking, patch: BookingPatch): Promise<never> {
  const stillThere = firstRow(await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, existing.id))
    .limit(1))

  if (!stillThere) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Booking not found',
      message: 'That booking has already been deleted.'
    })
  }

  const { roomId, externalVenueId } = resolveSpace(existing, patch)
  await validateBookingAvailability(
    roomId,
    externalVenueId,
    patch.startTime ?? existing.startTime,
    patch.endTime ?? existing.endTime,
    existing.id
  )

  throw createError({
    statusCode: 409,
    statusMessage: 'Space is not available',
    message: 'Someone else took that slot while this change was being saved. Try again.'
  })
}

/**
 * The same checks without the write, so a caller changing several bookings can
 * refuse the whole set before any of it lands.
 */
export async function planBookingChange(
  existing: Booking,
  patch: BookingPatch,
  options: { allowConflicts?: boolean } = {}
): Promise<PlannedBookingWrite> {
  const { roomId, externalVenueId } = resolveSpace(existing, patch)
  const startTime = patch.startTime ?? existing.startTime
  const endTime = patch.endTime ?? existing.endTime
  const status = patch.status ?? existing.status

  // A patch carrying one end could otherwise invert the window, which occupies
  // nothing and frees the room silently (docs/data-model.md#occupancy).
  if ((patch.startTime !== undefined || patch.endTime !== undefined) && endTime <= startTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'End time must be after start time',
      message: 'A booking must end after it starts.'
    })
  }

  if (TERMINAL.includes(existing.status) && !TERMINAL.includes(status)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Booking is closed',
      message: `A ${existing.status.toLowerCase()} booking cannot be reopened. Create a new booking instead.`
    })
  }

  // A rejected or cancelled booking holds nothing, so it cannot conflict.
  if (OCCUPYING.includes(status)) {
    await validateBookingAvailability(
      roomId,
      externalVenueId,
      startTime,
      endTime,
      existing.id,
      options.allowConflicts ?? false
    )
  }

  const changes = {
    ...(patch.roomId !== undefined && { roomId, externalVenueId }),
    ...(patch.externalVenueId !== undefined && { roomId, externalVenueId }),
    ...(patch.startTime !== undefined && { startTime }),
    ...(patch.endTime !== undefined && { endTime }),
    ...(patch.status !== undefined && { status }),
    ...(patch.rejectionReason !== undefined && { rejectionReason: patch.rejectionReason }),
    ...(patch.eventTitle !== undefined && { eventTitle: patch.eventTitle }),
    ...(patch.numberOfAttendees !== undefined && { numberOfAttendees: patch.numberOfAttendees }),
    ...(patch.notes !== undefined && { notes: patch.notes })
  }

  // Drizzle throws a bare Error on an empty set, which would surface as a 500.
  if (!Object.keys(changes).length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No changes supplied',
      message: 'Provide at least one field to update.'
    })
  }

  const guard = OCCUPYING.includes(status) && !options.allowConflicts
    ? spaceStillFree(existing.id, roomId, externalVenueId, startTime, endTime)
    : undefined

  return { changes, where: and(eq(schema.bookings.id, existing.id), guard)! }
}
