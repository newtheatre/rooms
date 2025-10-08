/**
 * Create Booking Endpoint
 *
 * Creates a new booking request for the authenticated user.
 *
 * Request Body:
 * - eventTitle: string
 * - numberOfAttendees?: number
 * - startTime: ISO 8601 datetime
 * - endTime: ISO 8601 datetime
 * - notes?: string
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Validate request body with createBookingSchema
 * 3. Create booking in database with status: PENDING
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

  // Parse and validate request body
  const data = await readValidatedBody(event, createBookingSchema.parse)

  // Create booking with PENDING status
  const booking = await db.booking.create({
    data: {
      userId: user.id,
      eventTitle: data.eventTitle,
      numberOfAttendees: data.numberOfAttendees,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      notes: data.notes,
      status: 'PENDING'
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
