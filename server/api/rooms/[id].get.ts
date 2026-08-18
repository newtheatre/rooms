/**
 * GET /api/rooms/:id — one room. Admin only.
 */

import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'

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

  const room = firstRow(await db
    .select({
      id: schema.rooms.id,
      name: schema.rooms.name,
      description: schema.rooms.description,
      capacity: schema.rooms.capacity,
      isActive: schema.rooms.isActive,
      createdAt: schema.rooms.createdAt,
      bookingCount: count(schema.bookings.id)
    })
    .from(schema.rooms)
    .leftJoin(schema.bookings, eq(schema.bookings.roomId, schema.rooms.id))
    .where(eq(schema.rooms.id, id))
    .groupBy(schema.rooms.id))

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  return room
})
