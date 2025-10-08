/**
 * List Rooms Endpoint
 *
 * Retrieves all internal rehearsal rooms.
 * - Regular users: Get basic room info (id, name, description, capacity) for active rooms only
 * - Admins: Get full details including isActive flag, creation date, and booking counts
 *
 * Query Parameters:
 * - includeInactive?: boolean (default: false, admin only - include inactive rooms)
 *
 * Process:
 * 1. Require authentication
 * 2. Check user role
 * 3. Build query filter for active/inactive rooms
 * 4. Fetch rooms from database
 * 5. Return full data for admins, limited data for users
 *
 * Response:
 * - 200: Array of room objects (full for admin, limited for users)
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method GET
 * @route /api/rooms
 * @authenticated
 */

import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'List rooms',
    description: 'Retrieves internal rehearsal rooms (all users can view active rooms, admins see all details)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'includeInactive',
        schema: { type: 'boolean' },
        description: 'Include inactive rooms (admin only)'
      }
    ],
    responses: {
      200: {
        description: 'List of rooms',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string', nullable: true },
                  capacity: { type: 'integer', nullable: true },
                  isActive: { type: 'boolean', description: 'Admin only' },
                  createdAt: { type: 'string', format: 'date-time', description: 'Admin only' },
                  bookingCount: { type: 'integer', description: 'Admin only' }
                }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication but allow all users
  const user = await requireAuth(event)

  const query = getQuery(event)
  const includeInactive = query.includeInactive === 'true'

  // Only admins can see inactive rooms
  const isAdmin = user.role === 'ADMIN'
  const showInactive = isAdmin && includeInactive

  const rooms = await prisma.room.findMany({
    where: showInactive ? {} : { isActive: true },
    include: {
      _count: isAdmin
        ? {
            select: { bookings: true }
          }
        : undefined
    },
    orderBy: { name: 'asc' }
  })

  // Return full data for admins, limited data for regular users
  if (isAdmin) {
    return rooms.map(room => ({
      ...room,
      bookingCount: room._count?.bookings || 0
    }))
  } else {
    // Regular users only get basic info
    return rooms.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      capacity: room.capacity
    }))
  }
})
