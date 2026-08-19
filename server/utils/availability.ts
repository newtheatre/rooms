/**
 * Booking conflict detection. A space is occupied by CONFIRMED, PENDING and
 * AWAITING_EXTERNAL — docs/data-model.md#occupancy
 */

import { db, schema } from '@nuxthub/db'
import { and, asc, eq, gt, isNotNull, lt, ne, inArray } from 'drizzle-orm'

const OCCUPYING_STATUSES = ['CONFIRMED', 'PENDING', 'AWAITING_EXTERNAL'] as const

type Booking = typeof schema.bookings.$inferSelect
type Room = typeof schema.rooms.$inferSelect

/** The conflicting booking plus who holds it, for the 409 payload. */
export type Conflict = Booking & {
  user: { id: string, name: string, email: string } | null
}

/** Shared by both space kinds; only the space predicate differs. */
async function findConflicts(
  spacePredicate: ReturnType<typeof eq>,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number
): Promise<Conflict[]> {
  const rows = await db
    .select({ booking: schema.bookings, user: schema.users })
    .from(schema.bookings)
    .leftJoin(schema.users, eq(schema.bookings.userId, schema.users.id))
    .where(and(
      spacePredicate,
      excludeBookingId ? ne(schema.bookings.id, excludeBookingId) : undefined,
      inArray(schema.bookings.status, [...OCCUPYING_STATUSES]),
      lt(schema.bookings.startTime, endTime),
      gt(schema.bookings.endTime, startTime)
    ))
    .orderBy(asc(schema.bookings.startTime))

  return rows.map(({ booking, user }) => ({
    ...booking,
    user: user ? { id: user.id, name: user.name, email: user.email } : null
  }))
}

/** `excludeBookingId` omits a booking's own rows, for editing it in place. */
export async function checkRoomAvailability(
  roomId: number,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number
): Promise<{ isAvailable: boolean, conflicts: Conflict[] }> {
  const conflicts = await findConflicts(
    eq(schema.bookings.roomId, roomId),
    startTime,
    endTime,
    excludeBookingId
  )

  return { isAvailable: conflicts.length === 0, conflicts }
}

/** As checkRoomAvailability, for an external venue. */
export async function checkVenueAvailability(
  externalVenueId: number,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number
): Promise<{ isAvailable: boolean, conflicts: Conflict[] }> {
  const conflicts = await findConflicts(
    eq(schema.bookings.externalVenueId, externalVenueId),
    startTime,
    endTime,
    excludeBookingId
  )

  return { isAvailable: conflicts.length === 0, conflicts }
}

/** Every room, split into available and unavailable for the range. */
export async function getAvailableRooms(
  startTime: Date,
  endTime: Date,
  options?: {
    excludeBookingId?: number
    includeInactive?: boolean
  }
): Promise<{
  available: Room[]
  unavailable: Array<Room & { conflicts: Conflict[] }>
}> {
  // Two queries whatever the room count: scoped by predicate, so the bound
  // parameter count does not grow with the rows covered (CLAUDE.md 10).
  const [rooms, occupied] = await Promise.all([
    db
      .select()
      .from(schema.rooms)
      .where(options?.includeInactive ? undefined : eq(schema.rooms.isActive, true))
      .orderBy(asc(schema.rooms.name)),
    findConflicts(
      isNotNull(schema.bookings.roomId),
      startTime,
      endTime,
      options?.excludeBookingId
    )
  ])

  const conflictsByRoom = new Map<number, Conflict[]>()
  for (const conflict of occupied) {
    if (conflict.roomId === null) continue
    const existing = conflictsByRoom.get(conflict.roomId)
    if (existing) existing.push(conflict)
    else conflictsByRoom.set(conflict.roomId, [conflict])
  }

  const available: Room[] = []
  const unavailable: Array<Room & { conflicts: Conflict[] }> = []

  for (const room of rooms) {
    const conflicts = conflictsByRoom.get(room.id)

    if (conflicts?.length) {
      unavailable.push({ ...room, conflicts })
    } else {
      available.push(room)
    }
  }

  return { available, unavailable }
}

/**
 * Throws 409 if the space is taken. `allowConflicts` is the admin override:
 * double-booking deliberately, which the UI asks about first.
 */
export async function validateBookingAvailability(
  roomId: number | undefined | null,
  externalVenueId: number | undefined | null,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number,
  allowConflicts = false
): Promise<void> {
  if (roomId) {
    const { isAvailable, conflicts } = await checkRoomAvailability(
      roomId,
      startTime,
      endTime,
      excludeBookingId
    )

    if (!isAvailable && !allowConflicts) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Room is not available',
        data: {
          message: `This room is already booked for the selected time. Found ${conflicts.length} conflicting booking(s).`,
          conflicts: conflicts.map(c => ({
            id: c.id,
            eventTitle: c.eventTitle,
            startTime: c.startTime,
            endTime: c.endTime,
            status: c.status
          }))
        }
      })
    }
  }

  if (externalVenueId) {
    const { isAvailable, conflicts } = await checkVenueAvailability(
      externalVenueId,
      startTime,
      endTime,
      excludeBookingId
    )

    if (!isAvailable && !allowConflicts) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Venue is not available',
        data: {
          message: `This venue is already booked for the selected time. Found ${conflicts.length} conflicting booking(s).`,
          conflicts: conflicts.map(c => ({
            id: c.id,
            eventTitle: c.eventTitle,
            startTime: c.startTime,
            endTime: c.endTime,
            status: c.status
          }))
        }
      })
    }
  }
}
