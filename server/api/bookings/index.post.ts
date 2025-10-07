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
