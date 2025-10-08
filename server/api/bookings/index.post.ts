/**
 * Create Booking Endpoint
 *
 * Creates a new booking request for the authenticated user.
 * Admins can create bookings on behalf of other users.
 *
 * Request Body (User):
 * - eventTitle: string
 * - numberOfAttendees?: number
 * - startTime: ISO 8601 datetime
 * - endTime: ISO 8601 datetime
 * - notes?: string
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
 * 3. Create booking in database
 * 4. Send confirmation email to user
 * 5. Notify all admins if booking is PENDING (new request needing review)
 * 6. Return created booking
 *
 * Response:
 * - 201: Booking object
 * - 400: Validation error
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method POST
 * @route /api/bookings
 * @authenticated
 */
import prisma from '~~/server/database'

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

  // Create booking
  const booking = await db.booking.create({
    data: {
      userId: bookingUserId,
      eventTitle: validatedData.eventTitle,
      numberOfAttendees: validatedData.numberOfAttendees,
      startTime: new Date(validatedData.startTime),
      endTime: new Date(validatedData.endTime),
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

  // Send confirmation notification
  if (booking.user) {
    const message = status === 'CONFIRMED'
      ? `Your booking "${booking.eventTitle}" has been confirmed${booking.room ? ` in ${booking.room.name}` : ''}.`
      : status === 'AWAITING_EXTERNAL'
        ? `Your booking "${booking.eventTitle}" has been submitted and is awaiting external venue confirmation.`
        : `Your booking request "${booking.eventTitle}" has been submitted and is pending review.`

    // Send notification (async, don't await)
    notifyBookingUpdate(booking.user, booking, message).catch((err) => {
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
      sendBatchEmail(
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
