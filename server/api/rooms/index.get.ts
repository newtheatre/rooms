/**
 * List internal rooms. Admins get every column plus booking counts and may ask
 * for inactive ones.
 */

import { db, schema } from '@nuxthub/db'
import { asc, count, eq } from 'drizzle-orm'

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
  const isAdmin = can(user, 'room.read.inactive')
  const showInactive = isAdmin && includeInactive

  // Non-admins get an explicit column list, never the whole row.
  if (!isAdmin) {
    return await db
      .select({
        id: schema.rooms.id,
        name: schema.rooms.name,
        description: schema.rooms.description,
        capacity: schema.rooms.capacity
      })
      .from(schema.rooms)
      .where(eq(schema.rooms.isActive, true))
      .orderBy(asc(schema.rooms.name))
  }

  return await db
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
    .where(showInactive ? undefined : eq(schema.rooms.isActive, true))
    .groupBy(schema.rooms.id)
    .orderBy(asc(schema.rooms.name))
})
