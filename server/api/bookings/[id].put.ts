/**
 * Update Booking Endpoint
 *
 * Updates a booking. Behavior differs by role:
 *
 * ADMIN can update:
 * - roomId (assign internal room)
 * - externalVenueId (assign external venue)
 * - status (change booking status)
 * - rejectionReason (when rejecting)
 *
 * STANDARD user can update (only for PENDING bookings they own):
 * - eventTitle
 * - numberOfAttendees
 * - startTime
 * - endTime
 * - notes
 *
 * Request Body:
 * - Admin: Validated with updateBookingSchema
 * - User: Validated with createBookingSchema (partial)
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Fetch existing booking
 * 3. Check authorization
 * 4. Validate request body based on role
 * 5. Update booking in database
 * 6. If admin changed status, send notification to user (if preferences allow)
 * 7. Return updated booking
 *
 * Response:
 * - 200: Updated booking object
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Unauthorized to update this booking
 * - 404: Booking not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method PUT
 * @route /api/bookings/[id]
 * @authenticated
 */
import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  const db = prisma

  // Parse booking ID from route params
  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid booking ID'
    })
  }

  // Fetch existing booking
  const existingBooking = await db.booking.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  if (!existingBooking) {
    throw createError({
      statusCode: 404,
      message: 'Booking not found'
    })
  }

  // Handle updates based on user role
  if (user.role === 'ADMIN') {
    // Admin can update booking assignment and status
    const data = await readValidatedBody(event, updateBookingSchema.parse)

    // Update booking
    const updatedBooking = await db.booking.update({
      where: { id },
      data: {
        ...(data.roomId !== undefined && { roomId: data.roomId, externalVenueId: null }),
        ...(data.externalVenueId !== undefined && { externalVenueId: data.externalVenueId, roomId: null }),
        ...(data.status && { status: data.status }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        room: true,
        externalVenue: true
      }
    })

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
    const updatedBooking = await db.booking.update({
      where: { id },
      data: {
        ...(data.eventTitle && { eventTitle: data.eventTitle }),
        ...(data.numberOfAttendees !== undefined && { numberOfAttendees: data.numberOfAttendees }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.notes !== undefined && { notes: data.notes })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        room: true,
        externalVenue: true
      }
    })

    return updatedBooking
  }
})
