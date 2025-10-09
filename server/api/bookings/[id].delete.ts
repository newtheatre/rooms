/**
 * Delete Booking Endpoint
 *
 * Deletes a booking. Admins can delete any booking, users can only cancel their own.
 *
 * Process:
 * 1. Require authentication
 * 2. Parse booking ID from route params
 * 3. Fetch existing booking
 * 4. Check authorization (admin or booking owner)
 * 5. Delete booking from database
 * 6. Send cancellation notification to user
 * 7. Return success message
 *
 * Response:
 * - 200: { message: "Booking deleted successfully" }
 * - 400: Invalid booking ID
 * - 401: Not authenticated
 * - 403: Not authorized to delete this booking
 * - 404: Booking not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method DELETE
 * @route /api/bookings/[id]
 * @authenticated
 */

import prisma from '~~/server/database'
import { notifyBookingUpdate, formatBookingDateTime } from '~~/server/utils/notifications'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Delete booking',
    description: 'Deletes a booking (admins can delete any, users can delete their own)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Booking ID'
      }
    ],
    responses: {
      200: {
        description: 'Booking deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Invalid booking ID' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not authorized to delete this booking' },
      404: { description: 'Booking not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid booking ID'
    })
  }

  // Check if booking exists
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: true
    }
  })

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: 'Booking not found'
    })
  }

  // Check authorization - admin can delete any, users can only delete their own
  if (user.role !== 'ADMIN' && booking.userId !== user.id) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to delete this booking'
    })
  }

  // Send notification before deletion if user exists
  if (booking.user) {
    const bookingDateTime = formatBookingDateTime(booking)
    const message = user.role === 'ADMIN'
      ? `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled by an administrator.`
      : `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled.`

    // Send notification
    await notifyBookingUpdate(booking.user, booking, message).catch((err) => {
      console.error('Failed to send booking cancellation notification:', err)
    })
  }

  // Delete the booking
  await prisma.booking.delete({
    where: { id }
  })

  return { message: 'Booking deleted successfully' }
})
