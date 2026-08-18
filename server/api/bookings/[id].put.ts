/**
 * Update a booking. Admin and owner send different bodies, validated against
 * different schemas — docs/api-reference.md#put-apibookingsid
 */
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { notifyBookingUpdate, formatBookingDateTime } from '~~/server/utils/notifications'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Update booking',
    description: 'Updates a booking (admins can assign rooms/change status, users can edit PENDING bookings)',
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
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              roomId: { type: 'integer', description: 'Assign internal room (admin only)' },
              externalVenueId: { type: 'integer', description: 'Assign external venue (admin only)' },
              status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'], description: 'Booking status (admin only)' },
              rejectionReason: { type: 'string', description: 'Reason for rejection (admin only)' },
              eventTitle: { type: 'string', description: 'Event title (user)' },
              numberOfAttendees: { type: 'integer', description: 'Number of attendees (user)' },
              startTime: { type: 'string', format: 'date-time', description: 'Start time (user)' },
              endTime: { type: 'string', format: 'date-time', description: 'End time (user)' },
              notes: { type: 'string', description: 'Notes (user)' }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Booking updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                status: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' },
      403: { description: 'Forbidden' },
      404: { description: 'Booking not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  // Parse booking ID from route params
  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid booking ID'
    })
  }

  // Fetch existing booking
  const existingBooking = firstRow(await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
    .limit(1))

  if (!existingBooking) {
    throw createError({
      statusCode: 404,
      message: 'Booking not found'
    })
  }

  // Handle updates based on user role
  if (hasRole(user, 'rooms', 'ADMIN')) {
    // Admin can update booking assignment and status
    const data = await readValidatedBody(event, updateBookingSchema.parse)

    // Track if status changed for notification
    const statusChanged = data.status && data.status !== existingBooking.status

    // Update booking
    await db
      .update(schema.bookings)
      .set({
        ...(data.roomId !== undefined && { roomId: data.roomId, externalVenueId: null }),
        ...(data.externalVenueId !== undefined && { externalVenueId: data.externalVenueId, roomId: null }),
        ...(data.status && { status: data.status }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason })
      })
      .where(eq(schema.bookings.id, id))

    const updatedBooking = await findBooking(id)
    if (!updatedBooking) {
      throw createError({ statusCode: 404, message: 'Booking not found' })
    }

    // Send notification if status changed
    if (statusChanged && updatedBooking.userId) {
      const bookingDateTime = formatBookingDateTime(updatedBooking)
      const statusMessages: Record<string, string> = {
        CONFIRMED: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been confirmed in ${updatedBooking.room ? `${updatedBooking.room.name}` : `${updatedBooking.externalVenue?.building} - ${updatedBooking.externalVenue?.roomName}`}.`,
        AWAITING_EXTERNAL: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been assigned to an external venue and is awaiting confirmation.`,
        REJECTED: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been rejected${updatedBooking.rejectionReason ? `: ${updatedBooking.rejectionReason}` : '.'}`,
        CANCELLED: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been cancelled.`
      }

      const message = statusMessages[updatedBooking.status] || `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) status has been updated to ${updatedBooking.status}.`

      // The response deliberately omits the notification columns.
      const fullUser = firstRow(await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, updatedBooking.userId))
        .limit(1))

      if (fullUser) {
        // Send notification
        await notifyBookingUpdate(fullUser, updatedBooking, message).catch((err) => {
          console.error('Failed to send booking notification:', err)
        })
      }
    }

    return updatedBooking
  } else {
    // Standard user can only update their own PENDING bookings
    if (existingBooking.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: 'You do not have permission to update this booking'
      })
    }

    if (existingBooking.status !== 'PENDING') {
      throw createError({
        statusCode: 403,
        message: 'Can only update bookings with PENDING status'
      })
    }

    // Validate with createBookingSchema (partial)
    const data = await readValidatedBody(event, createBookingSchema.partial().parse)

    // Update booking details
    await db
      .update(schema.bookings)
      .set({
        ...(data.eventTitle && { eventTitle: data.eventTitle }),
        ...(data.numberOfAttendees !== undefined && { numberOfAttendees: data.numberOfAttendees }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.notes !== undefined && { notes: data.notes })
      })
      .where(eq(schema.bookings.id, id))

    const updatedBooking = await findBooking(id)
    if (!updatedBooking) {
      throw createError({ statusCode: 404, message: 'Booking not found' })
    }

    return updatedBooking
  }
})
