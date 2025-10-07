/**
 * Get Room Details Endpoint
 *
 * Retrieves details for a specific room.
 * Admin-only endpoint.
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse room ID from route params
 * 3. Fetch room from database
 * 4. Optionally include bookings for this room
 * 5. Return room details
 *
 * Response:
 * - 200: Room object
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Room not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method GET
 * @route /api/rooms/[id]
 * @authenticated
 * @admin-only
 */

import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid room ID'
    })
  }

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  return {
    ...room,
    bookingCount: room._count.bookings
  }
})
