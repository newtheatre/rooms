/**
 * Create Booking Endpoint
 *
 * Creates a new booking request for the authenticated user.
 * Admins can create bookings on behalf of other users.
 * Supports single and recurring bookings.
 *
 * Request Body (User):
 * - eventTitle: string
 * - numberOfAttendees?: number
 * - startTime: ISO 8601 datetime
 * - endTime: ISO 8601 datetime
 * - notes?: string
 * - recurringPattern?: { frequency, interval, daysOfWeek, maxOccurrences, endDate }
 *
 * Request Body (Admin - additional fields):
 * - userId?: string (create on behalf of user)
 * - roomId?: number (assign internal room)
 * - externalVenueId?: number (assign external venue)
 * - status?: BookingStatus (override status)
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Validate request body (admin vs user schema)
 * 3. If recurring, generate all occurrences
 * 4. Check availability for room/venue assignments
 * 5. Create booking(s) in database
 * 6. Send confirmation email to user
 * 7. Notify all admins if booking is PENDING (new request needing review)
 * 8. Return created booking(s)
 *
 * Response:
 * - 201: Booking object or array of bookings (for recurring)
 * - 400: Validation error
 * - 401: Not authenticated
 * - 409: Availability conflict
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method POST
 * @route /api/bookings
 * @authenticated
 */
import prisma from '~~/server/database'
import { notifyBookingUpdate, getNotificationPreferences, sendBatchEmail, formatBookingDateTime } from '~~/server/utils/notifications'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Create booking',
    description: 'Creates a new booking request with PENDING status',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['eventTitle', 'startTime', 'endTime'],
            properties: {
              eventTitle: { type: 'string', description: 'Event title' },
              numberOfAttendees: { type: 'integer', description: 'Expected number of attendees' },
              startTime: { type: 'string', format: 'date-time', description: 'Event start time' },
              endTime: { type: 'string', format: 'date-time', description: 'Event end time' },
              notes: { type: 'string', description: 'Additional notes' }
            }
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Booking created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                userId: { type: 'string' },
                eventTitle: { type: 'string' },
                status: { type: 'string', enum: ['PENDING'] }
              }
            }
          }
        }
      },
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  const db = prisma

  // Check if user is admin
  const isAdmin = user.role === 'ADMIN'

  // Get raw body first to check if it's an admin request
  const rawBody = await readBody(event)

  // Parse and validate request body based on role and presence of userId
  let validatedData
  let bookingUserId = user.id
  let status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED' = 'PENDING'
  let roomId: number | undefined
  let externalVenueId: number | undefined

  if (isAdmin && rawBody.userId) {
    // Admin creating booking for another user
    validatedData = adminCreateBookingSchema.parse(rawBody)
    bookingUserId = validatedData.userId
    status = validatedData.status || (validatedData.roomId ? 'CONFIRMED' : validatedData.externalVenueId ? 'AWAITING_EXTERNAL' : 'PENDING')
    roomId = validatedData.roomId
    externalVenueId = validatedData.externalVenueId
  } else {
    // Regular user or admin creating for themselves
    validatedData = createBookingSchema.parse(rawBody)
  }

  const startTime = new Date(validatedData.startTime)
  const endTime = new Date(validatedData.endTime)

  // Check if this is a recurring booking
  const isRecurring = validatedData.recurringPattern && validatedData.recurringPattern.maxOccurrences > 1

  // If admin is assigning a room/venue, validate availability
  if (isAdmin && (roomId || externalVenueId)) {
    await validateBookingAvailability(
      roomId,
      externalVenueId,
      startTime,
      endTime,
      undefined,
      false // Don't allow conflicts for confirmed bookings
    )
  }

  // Create booking(s)
  let booking
  let bookingCount = 1

  if (isRecurring && validatedData.recurringPattern) {
    // Parse endDate if provided
    const recurringPattern = {
      ...validatedData.recurringPattern,
      endDate: validatedData.recurringPattern.endDate ? new Date(validatedData.recurringPattern.endDate) : undefined
    }

    // Create recurring bookings
    const result = await createRecurringBookings(
      {
        userId: bookingUserId,
        eventTitle: validatedData.eventTitle,
        numberOfAttendees: validatedData.numberOfAttendees,
        roomId,
        externalVenueId,
        status,
        notes: validatedData.notes
      },
      recurringPattern,
      startTime,
      endTime
    )

    bookingCount = 1 + result.childBookings.length

    // Fetch with relations
    booking = await db.booking.findUnique({
      where: { id: result.parentBooking.id },
      include: {
        user: true,
        room: true,
        externalVenue: true
      }
    })
  } else {
    // Create single booking
    booking = await db.booking.create({
      data: {
        userId: bookingUserId,
        eventTitle: validatedData.eventTitle,
        numberOfAttendees: validatedData.numberOfAttendees,
        startTime,
        endTime,
        notes: validatedData.notes,
        status,
        roomId,
        externalVenueId
      },
      include: {
        user: true,
        room: true,
        externalVenue: true
      }
    })
  }

  // Ensure booking was created
  if (!booking) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create booking'
    })
  }

  // Send confirmation notification
  if (booking.user) {
    const bookingDateTime = formatBookingDateTime(booking)
    const recurringNote = bookingCount > 1 ? ` (${bookingCount} occurrences)` : ''
    const message = status === 'CONFIRMED'
      ? `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been confirmed${booking.room ? ` in ${booking.room.name}` : ''}${recurringNote}.`
      : status === 'AWAITING_EXTERNAL'
        ? `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been submitted and is awaiting external venue confirmation${recurringNote}.`
        : `Your booking request "${booking.eventTitle}" (${bookingDateTime}) has been submitted and is pending review${recurringNote}.`

    // Send notification
    await notifyBookingUpdate(booking.user, booking, message).catch((err) => {
      console.error('Failed to send booking creation notification:', err)
    })
  }

  // Notify all admins if this is a new PENDING booking request
  if (status === 'PENDING') {
    // Fetch all admins who have opted in to new booking notifications
    const allAdmins = await db.user.findMany({
      where: { role: 'ADMIN' }
    })

    // Filter admins who want to receive new booking notifications
    const adminsToNotify = allAdmins.filter((admin) => {
      const preferences = getNotificationPreferences(admin)
      return preferences.includes('ADMIN_NEW_BOOKINGS')
    })

    if (adminsToNotify.length > 0) {
      const df = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })

      const adminMessage = `
        New booking request submitted by ${booking.user?.name || 'Unknown User'}
        
        Event: ${booking.eventTitle}
        Date: ${df.format(booking.startTime)} - ${df.format(booking.endTime)}
        ${booking.numberOfAttendees ? `Attendees: ${booking.numberOfAttendees}` : ''}
        ${booking.notes ? `Notes: ${booking.notes}` : ''}
        
        Please review and assign a room or venue.
      `

      // Send batch email to all subscribed admins
      await sendBatchEmail(
        adminsToNotify,
        'New Booking Request - Room Booking System',
        adminMessage
      ).catch((err) => {
        console.error('Failed to send batch admin notification:', err)
      })
    }
  }

  // Set 201 status code
  setResponseStatus(event, 201)

  return booking
})
