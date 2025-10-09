/**
 * Bulk Delete Bookings Endpoint
 *
 * Deletes multiple bookings at once (admin only).
 * Sends grouped notifications to users (one email per user with all their deletions).
 *
 * Request Body:
 * - bookingIds: Array of booking IDs to delete
 *
 * Response:
 * - 200: { deleted: number }
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 404: One or more bookings not found
 *
 * @method DELETE
 * @route /api/bookings/bulk
 * @authenticated
 * @admin
 */
import prisma from '~~/server/database'
import { notifyBulkBookingUpdates, formatBookingDateTime } from '~~/server/utils/notifications'
import { z } from 'zod'

const bulkDeleteSchema = z.object({
  bookingIds: z.array(z.number().int().positive()).min(1).max(100)
})

export default defineEventHandler(async (event) => {
  // Require admin session
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required'
    })
  }

  // Parse and validate body
  const body = await readBody(event)
  const validation = bulkDeleteSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { bookingIds } = validation.data

  // Fetch all bookings to verify they exist and get user info
  const bookingsToDelete = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds }
    },
    include: {
      user: true
    }
  })

  if (bookingsToDelete.length !== bookingIds.length) {
    const foundIds = new Set(bookingsToDelete.map(b => b.id))
    const missingIds = bookingIds.filter(id => !foundIds.has(id))
    throw createError({
      statusCode: 404,
      message: 'One or more bookings not found',
      data: { missingIds }
    })
  }

  // Prepare notifications before deletion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifications: Array<{ user: any, booking: any, message: string }> = []

  for (const booking of bookingsToDelete) {
    if (booking.user) {
      const bookingDateTime = formatBookingDateTime(booking)
      const message = `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled by an administrator.`

      notifications.push({
        user: booking.user,
        booking,
        message
      })
    }
  }

  // Delete all bookings
  await prisma.booking.deleteMany({
    where: {
      id: { in: bookingIds }
    }
  })

  // Send all notifications grouped by user (one email per user with all their deletions)
  await notifyBulkBookingUpdates(notifications).catch((err) => {
    console.error('Failed to send bulk deletion notifications:', err)
  })

  return {
    deleted: bookingsToDelete.length
  }
})
