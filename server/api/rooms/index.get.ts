/**
 * List internal rooms. Admins get every column plus booking counts and may ask
 * for inactive ones.
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
  const isAdmin = hasRole(user, 'rooms', 'ADMIN')
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
