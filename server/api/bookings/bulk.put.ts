/**
 * Update many bookings at once. Admin only. Notifications are grouped by user,
 * so five moved bookings send one email.
 */
import { db, schema } from '@nuxthub/db'
import { inArray } from 'drizzle-orm'
import { notifyBulkBookingUpdates, bookingStatusMessage } from '~~/server/utils/notifications'
import { z } from 'zod'
import { applyBookingChange } from '~~/server/utils/bookingWrites'
import { updateBookingSchema } from '~~/server/utils/validation'

// The canonical schema, not a copy: a local one silently lost the rule that a
// rejection carries a reason.
const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number().int().positive(),
      data: updateBookingSchema
    })
  ).min(1).max(100)
})

export default defineEventHandler(async (event) => {
  // Require admin session (scoped role via the estate session; staleness-checked)
  await requireAdmin(event)

  // Parse and validate body
  const body = await readBody(event)
  const validation = bulkUpdateSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { updates } = validation.data

  // Extract all booking IDs
  const bookingIds = updates.map(u => u.id)

  // Chunked: an IN list of the full 100 ids would bind D1's whole parameter
  // budget in one statement (CLAUDE.md invariant 10).
  const existingBookings = await chunkedByIds(bookingIds, ids => db
    .select()
    .from(schema.bookings)
    .where(inArray(schema.bookings.id, ids)))

  if (existingBookings.length !== bookingIds.length) {
    const foundIds = new Set(existingBookings.map(b => b.id))
    const missingIds = bookingIds.filter(id => !foundIds.has(id))
    throw createError({
      statusCode: 404,
      message: 'One or more bookings not found',
      data: { missingIds }
    })
  }

  // Create a map for quick lookup
  const existingBookingsMap = new Map(existingBookings.map(b => [b.id, b]))

  // Process all updates
  const updatedBookings = []
  const pending: Array<{ userId: string, booking: BookingWithRelations, message: string }> = []

  for (const update of updates) {
    const existingBooking = existingBookingsMap.get(update.id)
    if (!existingBooking) continue

    const data = update.data

    // Track if status changed for notification
    const statusChanged = data.status && data.status !== existingBooking.status

    // One statement per booking: a fixed parameter count regardless of batch.
    await applyBookingChange(existingBooking, {
      ...data,
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.endTime && { endTime: new Date(data.endTime) })
    }, { allowConflicts: data.allowConflicts })

    const updatedBooking = await findBooking(update.id)
    if (!updatedBooking) continue

    updatedBookings.push(updatedBooking)

    // Queue notification if status changed
    if (statusChanged && updatedBooking.userId) {
      const message = bookingStatusMessage(updatedBooking)

      pending.push({
        userId: updatedBooking.userId,
        booking: updatedBooking,
        message
      })
    }
  }

  // The notification needs the columns the booking response deliberately omits.
  const usersById = await loadUsersByIds(pending.map(p => p.userId))
  const notifications = pending.flatMap(({ userId, booking, message }) => {
    const notifyUser = usersById.get(userId)
    return notifyUser ? [{ user: notifyUser, booking, message }] : []
  })

  // Send all notifications grouped by user (one email per user with all their updates)
  await notifyBulkBookingUpdates(notifications).catch((err) => {
    console.error('Failed to send bulk booking notifications:', err)
  })

  return {
    updated: updatedBookings.length,
    bookings: updatedBookings
  }
})
