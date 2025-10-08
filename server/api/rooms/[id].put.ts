/**
 * Update Room Endpoint
 *
 * Updates an internal rehearsal room.
 * Admin-only endpoint.
 *
 * Request Body (all optional):
 * - name?: string
 * - description?: string
 * - capacity?: number
 * - isActive?: boolean
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse room ID from route params
 * 3. Validate request body
 * 4. Fetch existing room
 * 5. Update room in database
 * 6. Return updated room
 *
 * Response:
 * - 200: Updated room object
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Room not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method PUT
 * @route /api/rooms/[id]
 * @authenticated
 * @admin-only
 */

import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'Update room',
    description: 'Updates an internal rehearsal room (admin only)',
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
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Room name' },
              description: { type: 'string', description: 'Room description' },
              capacity: { type: 'integer', description: 'Room capacity' },
              isActive: { type: 'boolean', description: 'Is room active' }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Room updated successfully',
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
      400: { description: 'Validation error or invalid room ID' },
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

  const body = await readValidatedBody(event, createRoomSchema.partial().parse)

  // Check if room exists
  const existing = await prisma.room.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  const room = await prisma.room.update({
    where: { id },
    data: body,
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  return {
    ...room,
    bookingCount: room._count.bookings
  }
})
