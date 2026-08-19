/**
 * Create a booking request. Admins may also set userId, a space and a status.
 * See docs/api-reference.md#post-apibookings
 */
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
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

  // Check if user is admin
  const isAdmin = await canNow(event, 'booking.manage.any')

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
    validatedData = parseOr400(adminCreateBookingSchema, rawBody)
    bookingUserId = validatedData.userId
    status = validatedData.status || (validatedData.roomId ? 'CONFIRMED' : validatedData.externalVenueId ? 'AWAITING_EXTERNAL' : 'PENDING')
    roomId = validatedData.roomId
    externalVenueId = validatedData.externalVenueId
  } else {
    // Regular user or admin creating for themselves
    validatedData = parseOr400(createBookingSchema, rawBody)
  }

  const startTime = new Date(validatedData.startTime)
  const endTime = new Date(validatedData.endTime)

  // Check if this is a recurring booking
  const isRecurring = validatedData.recurringPattern && validatedData.recurringPattern.maxOccurrences > 1

  // A recurring booking checks every occurrence inside createRecurringBookings.
  if (isAdmin && !isRecurring && (roomId || externalVenueId)) {
    await validateBookingAvailability(roomId, externalVenueId, startTime, endTime)
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
    booking = await findBooking(result.parentBooking.id)
  } else {
    // Create single booking
    const created = requireRow(await db
      .insert(schema.bookings)
      .values({
        userId: bookingUserId,
        eventTitle: validatedData.eventTitle,
        numberOfAttendees: validatedData.numberOfAttendees,
        startTime,
        endTime,
        notes: validatedData.notes,
        status,
        roomId,
        externalVenueId
      })
      .returning())

    booking = await findBooking(created.id)
  }

  // Ensure booking was created
  if (!booking) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create booking'
    })
  }

  const notifyUser = await loadUserForNotify(booking.userId)

  // Send confirmation notification
  if (notifyUser) {
    const bookingDateTime = formatBookingDateTime(booking)
    const recurringNote = bookingCount > 1 ? ` (${bookingCount} occurrences)` : ''
    const message = status === 'CONFIRMED'
      ? `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been confirmed${booking.room ? ` in ${booking.room.name}` : ''}${recurringNote}.`
      : status === 'AWAITING_EXTERNAL'
        ? `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been submitted and is awaiting external venue confirmation${recurringNote}.`
        : `Your booking request "${booking.eventTitle}" (${bookingDateTime}) has been submitted and is pending review${recurringNote}.`

    // Send notification
    await notifyBookingUpdate(notifyUser, booking, message).catch((err) => {
      console.error('Failed to send booking creation notification:', err)
    })
  }

  // Notify all admins if this is a new PENDING booking request
  if (status === 'PENDING') {
    // Fetch all admins who have opted in to new booking notifications
    const allAdmins = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isRoomsAdmin, true))

    // Filter admins who want to receive new booking notifications
    const adminsToNotify = allAdmins.filter((admin) => {
      const preferences = getNotificationPreferences(admin)
      return preferences.includes('ADMIN_NEW_BOOKINGS')
    })

    if (adminsToNotify.length > 0) {
      const adminMessage = `
        New booking request submitted by ${booking.user?.name || 'Unknown User'}

        Event: ${booking.eventTitle}
        Date: ${formatBookingDateTime(booking)}
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
