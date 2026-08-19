/**
 * The one path by which a booking's space or window changes. Every write
 * re-checks occupancy, so a route cannot forget it (CLAUDE.md invariant 4).
 */

import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
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

/** Assigning one space clears the other: a booking is never in both. */
function resolveSpace(existing: Booking, patch: BookingPatch) {
  if (patch.roomId !== undefined) return { roomId: patch.roomId, externalVenueId: null }
  if (patch.externalVenueId !== undefined) return { roomId: null, externalVenueId: patch.externalVenueId }
  return { roomId: existing.roomId, externalVenueId: existing.externalVenueId }
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
  const { roomId, externalVenueId } = resolveSpace(existing, patch)
  const startTime = patch.startTime ?? existing.startTime
  const endTime = patch.endTime ?? existing.endTime
  const status = patch.status ?? existing.status

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

  await db.update(schema.bookings).set(changes).where(eq(schema.bookings.id, existing.id))
}
