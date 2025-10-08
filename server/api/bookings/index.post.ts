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
 * 4. TODO: Notify admins of new booking request
 * 5. Return created booking
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
import { createBookingSchema, adminCreateBookingSchema } from '~~/server/utils/validation'

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

  // Set 201 status code
  setResponseStatus(event, 201)

  return booking
})
