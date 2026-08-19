/**
 * DELETE /api/bookings/:id — delete a booking. Owner or admin. Notifies the
 * owner.
 */

import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
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
  const booking = await findBooking(id)

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: 'Booking not found'
    })
  }

  // Check authorization - admin can delete any, users can only delete their own
  if (!can(user, 'booking.manage.any') && booking.userId !== user.id) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to delete this booking'
    })
  }

  // The notification needs the columns the booking response deliberately omits.
  const notifyUser = booking.userId
    ? firstRow(await db.select().from(schema.users).where(eq(schema.users.id, booking.userId)).limit(1))
    : undefined

  // Send notification before deletion if user exists
  if (notifyUser) {
    const bookingDateTime = formatBookingDateTime(booking)
    const message = can(user, 'booking.manage.any')
      ? `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled by an administrator.`
      : `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled.`

    // Send notification
    await notifyBookingUpdate(notifyUser, booking, message).catch((err) => {
      console.error('Failed to send booking cancellation notification:', err)
    })
  }

  // Delete the booking
  await db.delete(schema.bookings).where(eq(schema.bookings.id, id))

  return { message: 'Booking deleted successfully' }
})
