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

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'Get room details',
    description: 'Retrieves details for a specific room (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Room ID'
      }
    ],
    responses: {
      200: {
        description: 'Room details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                capacity: { type: 'integer', nullable: true },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                bookingCount: { type: 'integer' }
              }
            }
          }
        }
      },
      400: { description: 'Invalid room ID' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      404: { description: 'Room not found' }
    }
  }
})

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
