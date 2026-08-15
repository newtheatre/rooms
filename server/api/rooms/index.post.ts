/**
 * POST /api/rooms — create an internal room. Admin only.
 */

import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'Create room',
    description: 'Creates a new internal rehearsal room (admin only)',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name'],
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
      201: {
        description: 'Room created successfully',
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
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, createRoomSchema.parse)

  const { name, description, capacity, isActive } = body

  const room = await prisma.room.create({
    data: {
      name,
      description,
      capacity,
      isActive
    },
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  setResponseStatus(event, 201)
  return {
    ...room,
    bookingCount: room._count.bookings
  }
})
