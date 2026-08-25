/**
 * Deleting a booking row cascades to its children, so the head of a series
 * cannot just be removed (ADR-0003).
 */

import { db, schema } from '@nuxthub/db'
import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { Booking } from '~~/server/db/schema/booking'

/** The id every occurrence in the series hangs off. */
export function seriesParentId(booking: Booking): number {
  return booking.parentBookingId ?? booking.id
}

/** Still holding a slot, so still worth applying a series-wide change to. */
export function isOpen(booking: Booking): boolean {
  return isOpenStatus(booking.status)
}

export function isSeriesMember(booking: Booking): boolean {
  return booking.parentBookingId !== null || booking.occurrenceNumber !== null
}

/** Every occurrence, the head included, oldest first. */
export async function seriesBookings(parentId: number): Promise<Booking[]> {
  const [head, children] = await Promise.all([
    db.select().from(schema.bookings).where(eq(schema.bookings.id, parentId)),
    db.select().from(schema.bookings)
      .where(eq(schema.bookings.parentBookingId, parentId))
      .orderBy(asc(schema.bookings.startTime))
  ])

  return [...head, ...children]
}

/** Every occurrence of each of several series, deduplicated. */
export async function seriesBookingsForParents(parentIds: number[]): Promise<Booking[]> {
  // Chunked: an id list from a result set would otherwise grow with it.
  const [heads, children] = await Promise.all([
    chunkedByIds(parentIds, ids => db.select().from(schema.bookings)
      .where(inArray(schema.bookings.id, ids))),
    chunkedByIds(parentIds, ids => db.select().from(schema.bookings)
      .where(inArray(schema.bookings.parentBookingId, ids)))
  ])

  return [...new Map([...heads, ...children].map(booking => [booking.id, booking])).values()]
}

/**
 * The writes that move a series onto its next occurrence, so the head can go
 * without the cascade taking the rest. Empty for a booking with no children.
 */
export async function promoteNextOccurrenceWrites(parentId: number): Promise<BatchItem<'sqlite'>[]> {
  const successor = firstRow(await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.parentBookingId, parentId))
    .orderBy(asc(schema.bookings.startTime))
    .limit(1))

  if (!successor) return []

  return [
    // Detach first: the successor must not point at a row that is about to go.
    db
      .update(schema.bookings)
      .set({ parentBookingId: null })
      .where(eq(schema.bookings.id, successor.id)),

    // One statement however many siblings move, so the parameter count is fixed.
    db
      .update(schema.bookings)
      .set({ parentBookingId: successor.id })
      .where(and(
        eq(schema.bookings.parentBookingId, parentId),
        ne(schema.bookings.id, successor.id)
      )),

    // The pattern hangs off the head and cascades with it.
    db
      .update(schema.recurringPatterns)
      .set({ bookingId: successor.id })
      .where(eq(schema.recurringPatterns.bookingId, parentId))
  ]
}

/**
 * Promotion and the delete land together, or neither does: a half-run promotion
 * splits the series in two and no later scope=series delete clears both halves.
 */
export async function deleteBookingWithPromotion(bookingId: number): Promise<void> {
  const writes: BatchItem<'sqlite'>[] = await promoteNextOccurrenceWrites(bookingId)
  writes.push(db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId)))

  await db.batch(writes as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
}
