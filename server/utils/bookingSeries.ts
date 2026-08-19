/**
 * Deleting a booking row cascades to its children, so the head of a series
 * cannot just be removed (ADR-0003).
 */

import { db, schema } from '@nuxthub/db'
import { and, asc, eq, ne } from 'drizzle-orm'
import type { Booking } from '~~/server/db/schema/booking'

/** The id every occurrence in the series hangs off. */
export function seriesParentId(booking: Booking): number {
  return booking.parentBookingId ?? booking.id
}

/** Still holding a slot, so still worth applying a series-wide change to. */
export function isOpen(booking: Booking): boolean {
  return booking.status !== 'REJECTED' && booking.status !== 'CANCELLED'
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

/**
 * Moves the series onto its next occurrence so the head can be deleted without
 * the cascade taking the rest with it. No-op for a booking with no children.
 */
export async function promoteNextOccurrence(parentId: number): Promise<void> {
  const successor = firstRow(await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.parentBookingId, parentId))
    .orderBy(asc(schema.bookings.startTime))
    .limit(1))

  if (!successor) return

  // Detach first: the successor must not point at a row that is about to go.
  await db
    .update(schema.bookings)
    .set({ parentBookingId: null })
    .where(eq(schema.bookings.id, successor.id))

  // One statement however many siblings move, so the parameter count is fixed.
  await db
    .update(schema.bookings)
    .set({ parentBookingId: successor.id })
    .where(and(
      eq(schema.bookings.parentBookingId, parentId),
      ne(schema.bookings.id, successor.id)
    ))

  // The pattern hangs off the head and cascades with it.
  await db
    .update(schema.recurringPatterns)
    .set({ bookingId: successor.id })
    .where(eq(schema.recurringPatterns.bookingId, parentId))
}
