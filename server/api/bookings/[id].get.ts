/**
 * Get Booking Details Endpoint
 *
 * Retrieves details for a specific booking.
 * Users can only view their own bookings.
 * Admins can view any booking.
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Fetch booking from database with relations
 * 3. Check authorization (user owns booking OR user is admin)
 * 4. Return booking details
 *
 * Response:
 * - 200: Booking object with relations (user, room, externalVenue)
 * - 401: Not authenticated
 * - 403: User doesn't own this booking and is not admin
 * - 404: Booking not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method GET
 * @route /api/bookings/[id]
 * @authenticated
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Get booking details',
    description: 'Retrieves details for a specific booking (users can only view their own)',
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
    responses: {
      200: {
        description: 'Booking details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                userId: { type: 'string', nullable: true },
                roomId: { type: 'integer', nullable: true },
                externalVenueId: { type: 'integer', nullable: true },
                eventTitle: { type: 'string' },
                numberOfAttendees: { type: 'integer', nullable: true },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
                status: { type: 'string' },
                notes: { type: 'string', nullable: true },
                rejectionReason: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' },
      403: { description: 'Forbidden' },
      404: { description: 'Booking not found' }
    }
  }
})

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

  // Fetch booking with relations
  const booking = await db.booking.findUnique({
    where: { id },
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

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: 'Booking not found'
    })
  }

  // Check authorization: user owns booking OR user is admin
  if (booking.userId !== user.id && user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this booking'
    })
  }

  return booking
})
