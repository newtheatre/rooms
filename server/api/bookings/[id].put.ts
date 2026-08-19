/**
 * Update a booking. Admin and owner send different bodies, validated against
 * different schemas. See docs/api-reference.md#put-apibookingsid
 */
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { notifyBookingUpdate, notifyAdmins, bookingStatusMessage, formatBookingDateTime } from '~~/server/utils/notifications'
import { applyBookingChange } from '~~/server/utils/bookingWrites'
import { isOpen, isSeriesMember, seriesBookings, seriesParentId } from '~~/server/utils/bookingSeries'

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
              status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'], description: 'Admin sets any status; an owner may only send CANCELLED' },
              rejectionReason: { type: 'string', description: 'Reason for rejection (admin only)' },
              allowConflicts: { type: 'boolean', description: 'Assign despite a clash (admin only)' },
              eventTitle: { type: 'string', description: 'Event title (admin or owner)' },
              numberOfAttendees: { type: 'integer', description: 'Number of attendees (admin or owner)' },
              startTime: { type: 'string', format: 'date-time', description: 'Start time (admin or owner)' },
              endTime: { type: 'string', format: 'date-time', description: 'End time (admin or owner)' },
              notes: { type: 'string', description: 'Notes (admin or owner)' }
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
      404: { description: 'Booking not found' },
      409: { description: 'Clashes with an existing booking, or the booking is closed' }
    }
  }
})

function buildMemberCancellationMessage(booking: BookingWithRelations, cancelledBy: string): string {
  const space = booking.room
    ? `Room: ${booking.room.name}`
    : booking.externalVenue
      ? `EXTERNAL VENUE: ${booking.externalVenue.building} - ${booking.externalVenue.roomName}. This was arranged by hand, so the venue still needs to be told.`
      : 'No space had been assigned.'

  return [
    `${cancelledBy} has cancelled their own booking.`,
    '',
    `Event: ${booking.eventTitle}`,
    `When: ${formatBookingDateTime(booking)}`,
    space
  ].join('\n')
}

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
  if (await canNow(event, 'booking.manage.any')) {
    // Admin can update booking assignment and status
    const data = await readValidatedBody(event, updateBookingSchema.parse)
    const { scope } = await getValidatedQuery(event, bookingUpdateQuerySchema.parse)

    // Track if status changed for notification
    const statusChanged = data.status && data.status !== existingBooking.status

    const patch = {
      ...data,
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.endTime && { endTime: new Date(data.endTime) })
    }

    // Resolved server-side: deriving the series from the rows a client happens
    // to hold would silently shrink once the list is paged.
    const targets = scope === 'series' && isSeriesMember(existingBooking)
      ? (await seriesBookings(seriesParentId(existingBooking))).filter(isOpen)
      : [existingBooking]

    for (const target of targets) {
      // Moving a whole series to one instant would stack every occurrence.
      const perTarget = target.id === existingBooking.id
        ? patch
        : { ...patch, startTime: undefined, endTime: undefined }

      await applyBookingChange(target, perTarget, { allowConflicts: data.allowConflicts })
    }

    const updatedBooking = await findBooking(id)
    if (!updatedBooking) {
      throw createError({ statusCode: 404, message: 'Booking not found' })
    }

    // Send notification if status changed
    if (statusChanged && updatedBooking.userId) {
      const message = bookingStatusMessage(updatedBooking)

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

    const data = await readValidatedBody(event, ownerUpdateBookingSchema.parse)
    const isCancellation = data.status === 'CANCELLED'

    // Cancelling a confirmed slot is allowed; editing its details is not.
    if (isCancellation) {
      if (existingBooking.status !== 'PENDING' && existingBooking.status !== 'CONFIRMED') {
        throw createError({
          statusCode: 403,
          message: 'Only pending or confirmed bookings can be cancelled'
        })
      }
    } else if (existingBooking.status !== 'PENDING') {
      throw createError({
        statusCode: 403,
        message: 'Can only update bookings with PENDING status'
      })
    }

    await applyBookingChange(existingBooking, {
      ...data,
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.endTime && { endTime: new Date(data.endTime) })
    })

    const updatedBooking = await findBooking(id)
    if (!updatedBooking) {
      throw createError({ statusCode: 404, message: 'Booking not found' })
    }

    // An external venue was arranged by hand, so someone has to unarrange it.
    if (isCancellation) {
      await notifyAdmins(
        `Booking cancelled by member: ${updatedBooking.eventTitle}`,
        buildMemberCancellationMessage(updatedBooking, user.name)
      ).catch((err) => {
        console.error('Failed to alert admins to a member cancellation:', err)
      })
    }

    return updatedBooking
  }
})
