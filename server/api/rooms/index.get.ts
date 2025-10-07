/**
 * List Rooms Endpoint
 *
 * Retrieves all internal rehearsal rooms.
 * Admin-only endpoint.
 *
 * Query Parameters:
 * - includeInactive?: boolean (default: false, include inactive rooms)
 *
 * Process:
 * 1. Require admin authentication
 * 2. Build query filter for active/inactive rooms
 * 3. Fetch rooms from database
 * 4. Optionally include booking count per room
 * 5. Return rooms array
 *
 * Response:
 * - 200: Array of room objects
 * - 401: Not authenticated
 * - 403: Not admin
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method GET
 * @route /api/rooms
 * @authenticated
 * @admin-only
 */

import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const includeInactive = query.includeInactive === 'true'

  const rooms = await prisma.room.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: {
        select: { bookings: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  return rooms.map(room => ({
    ...room,
    bookingCount: room._count.bookings
  }))
})
