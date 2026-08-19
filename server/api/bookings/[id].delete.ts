/**
 * DELETE /api/bookings/:id: delete a booking. Owner or admin. Notifies the
 * owner.
 */

import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { notifyBookingUpdate, formatBookingDateTime } from '~~/server/utils/notifications'
import { isSeriesMember, promoteNextOccurrence, seriesBookings, seriesParentId } from '~~/server/utils/bookingSeries'

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
      },
      {
        in: 'query',
        name: 'scope',
        required: false,
        schema: { type: 'string', enum: ['occurrence', 'series'], default: 'occurrence' },
        description: 'Delete just this occurrence, or the whole recurring series'
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
  const isAdmin = await canNow(event, 'booking.manage.any')

  if (!isAdmin && booking.userId !== user.id) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to delete this booking'
    })
  }

  const { scope } = await getValidatedQuery(event, bookingDeleteQuerySchema.parse)
  const deletingSeries = scope === 'series' && isSeriesMember(booking)

  const doomed = deletingSeries
    ? await seriesBookings(seriesParentId(booking))
    : [booking]

  const notifyUser = await loadUserForNotify(booking.userId)

  // Send notification before deletion if user exists
  if (notifyUser) {
    const bookingDateTime = formatBookingDateTime(booking)
    const suffix = isAdmin ? ' by an administrator' : ''

    const message = deletingSeries
      ? `All ${doomed.length} occurrences of your booking "${booking.eventTitle}" have been cancelled${suffix}.`
      : `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled${suffix}.`

    // Send notification
    await notifyBookingUpdate(notifyUser, booking, message).catch((err) => {
      console.error('Failed to send booking cancellation notification:', err)
    })
  }

  if (deletingSeries) {
    // Deleting the head cascades to the rest, which is what is wanted here.
    await db.delete(schema.bookings).where(eq(schema.bookings.id, seriesParentId(booking)))
  } else {
    // Otherwise the cascade would take every later occurrence with it.
    await promoteNextOccurrence(id)
    await db.delete(schema.bookings).where(eq(schema.bookings.id, id))
  }

  return {
    message: 'Booking deleted successfully',
    deleted: doomed.length
  }
})
