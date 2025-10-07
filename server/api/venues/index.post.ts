/**
 * Create External Venue Endpoint
 *
 * Creates a new external venue record.
 * Admin-only endpoint.
 *
 * Request Body:
 * - campus?: string
 * - building: string
 * - roomName: string
 * - contactDetails?: string
 *
 * Process:
 * 1. Require admin authentication
 * 2. Validate request body with createVenueSchema
 * 3. Create venue in database
 * 4. Return created venue
 *
 * Response:
 * - 201: Venue object
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not admin
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method POST
 * @route /api/venues
 * @authenticated
 * @admin-only
 */

import prisma from '../../database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, createVenueSchema.parse)

  const { campus, building, roomName, contactDetails } = body

  const venue = await prisma.externalVenue.create({
    data: {
      campus,
      building,
      roomName,
      contactDetails
    },
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  setResponseStatus(event, 201)
  return {
    ...venue,
    bookingCount: venue._count.bookings
  }
})
