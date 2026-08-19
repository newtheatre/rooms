/**
 * The booking-with-relations shape every booking endpoint returns. Kept in one
 * place so the client sees the same object from list, get, create and update.
 */

import { db, schema } from '@nuxthub/db'
import { eq, inArray, type SQL } from 'drizzle-orm'

/**
 * The user columns a booking may carry. Deliberately not the whole row: the
 * mirror also holds notification settings (CLAUDE.md, column allow-lists).
 */
const bookingUserColumns = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email
}

const selection = {
  booking: schema.bookings,
  user: bookingUserColumns,
  room: schema.rooms,
  externalVenue: schema.externalVenues
}

type Row = {
  booking: typeof schema.bookings.$inferSelect
  user: { id: string | null, name: string | null, email: string | null }
  room: typeof schema.rooms.$inferSelect | null
  externalVenue: typeof schema.externalVenues.$inferSelect | null
}

/** A left join yields all-null columns rather than null when nothing matched. */
function flatten(row: Row) {
  return {
    ...row.booking,
    user: row.user?.id ? row.user : null,
    room: row.room?.id ? row.room : null,
    externalVenue: row.externalVenue?.id ? row.externalVenue : null
  }
}

export type BookingWithRelations = ReturnType<typeof flatten>

/** Bookings matching `where`, newest first unless `order` says otherwise. */
export async function findBookings(
  where?: SQL,
  order?: SQL[],
  page?: { limit: number, offset: number }
): Promise<BookingWithRelations[]> {
  const query = db
    .select(selection)
    .from(schema.bookings)
    .leftJoin(schema.users, eq(schema.bookings.userId, schema.users.id))
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .leftJoin(schema.externalVenues, eq(schema.bookings.externalVenueId, schema.externalVenues.id))
    .where(where)

  const ordered = order?.length ? query.orderBy(...order) : query
  const rows = page ? await ordered.limit(page.limit).offset(page.offset) : await ordered

  return (rows as Row[]).map(flatten)
}

/** Rows for the requested page plus the total the filter matches. */
export async function findBookingsPage(
  where: SQL | undefined,
  order: SQL[],
  page: { limit: number, offset: number }
): Promise<Paged<BookingWithRelations>> {
  const [items, total] = await Promise.all([
    findBookings(where, order, page),
    countRows(schema.bookings, where)
  ])

  return { items, total, limit: page.limit, offset: page.offset }
}

/** One booking with its relations, or undefined. */
export async function findBooking(id: number): Promise<BookingWithRelations | undefined> {
  const rows = await findBookings(eq(schema.bookings.id, id))
  return rows[0]
}

/**
 * Full user rows keyed by id, for notification fan-out. Bookings carry an
 * allow-listed user, which deliberately omits the notification columns.
 */
export async function loadUsersByIds(userIds: string[]) {
  const unique = [...new Set(userIds)]
  const rows = await chunkedByIds(unique, chunk => db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, chunk)))

  return new Map(rows.map(row => [row.id, row]))
}
