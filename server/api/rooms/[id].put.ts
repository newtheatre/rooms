/**
 * PUT /api/rooms/:id — update an internal room. Admin only. Partial body.
 */

import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'

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

  const room = firstRow(await db
    .update(schema.rooms)
    .set(body)
    .where(eq(schema.rooms.id, id))
    .returning())

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  const [bookings] = await db
    .select({ value: count() })
    .from(schema.bookings)
    .where(eq(schema.bookings.roomId, id))

  return { ...room, bookingCount: bookings?.value ?? 0 }
})
