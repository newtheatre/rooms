/**
 * GET /api/users/:id — one local user mirror, with their bookings. Admin only.
 */
import { db, schema } from '@nuxthub/db'
import { count, desc, eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Get user details',
    description: 'Retrieves details for a specific user (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'User ID'
      }
    ],
    responses: {
      200: {
        description: 'User details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },

                createdAt: { type: 'string', format: 'date-time' },
                bookingCount: { type: 'integer' },
                recentBookings: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      },
      400: { description: 'Invalid user ID' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      404: { description: 'User not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdmin(event)

  // Get user ID from route params
  const userId = getRouterParam(event, 'id')

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  // Column allow-listed: the mirror also holds notification settings.
  const user = firstRow(await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1))

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  const bookings = firstRow(await db
    .select({ value: count() })
    .from(schema.bookings)
    .where(eq(schema.bookings.userId, userId)))

  const recentBookings = await db
    .select({
      id: schema.bookings.id,
      eventTitle: schema.bookings.eventTitle,
      startTime: schema.bookings.startTime,
      endTime: schema.bookings.endTime,
      status: schema.bookings.status
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.userId, userId))
    .orderBy(desc(schema.bookings.startTime))
    .limit(5)

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    bookingCount: bookings?.value ?? 0,
    recentBookings
  }
})
