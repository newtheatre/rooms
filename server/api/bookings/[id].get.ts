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
