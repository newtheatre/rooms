/**
 * Deactivate a room, or remove it with `permanent=true`. Permanent deletion is
 * refused once the room has bookings.
 */

import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'Delete room',
    description: 'Permanently deletes or soft-deletes a room (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Room ID'
      },
      {
        in: 'query',
        name: 'permanent',
        schema: { type: 'boolean' },
        description: 'Permanently delete the room'
      }
    ],
    responses: {
      200: {
        description: 'Room deleted/deactivated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Invalid room ID or room has bookings' },
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

  const { permanent } = await getValidatedQuery(event, roomDeleteQuerySchema.parse)

  // Check if room exists
  const room = firstRow(await db
    .select({ id: schema.rooms.id })
    .from(schema.rooms)
    .where(eq(schema.rooms.id, id))
    .limit(1))

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  if (permanent) {
    // Check if room has bookings
    const [bookings] = await db
      .select({ value: count() })
      .from(schema.bookings)
      .where(eq(schema.bookings.roomId, id))

    if ((bookings?.value ?? 0) > 0) {
      throw createError({
        statusCode: 400,
        message: 'Cannot permanently delete room with existing bookings. Deactivate it instead.'
      })
    }

    // Hard delete - permanently remove from database
    await db.delete(schema.rooms).where(eq(schema.rooms.id, id))

    return { message: 'Room permanently deleted' }
  } else {
    // Soft delete - set isActive to false
    await db.update(schema.rooms).set({ isActive: false }).where(eq(schema.rooms.id, id))

    return { message: 'Room deactivated successfully' }
  }
})
