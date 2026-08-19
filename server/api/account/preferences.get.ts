/**
 * GET /api/account/preferences: the caller's notification channels and types.
 * Both are stored as JSON strings and parsed here.
 */
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Account'],
    summary: 'Get notification preferences',
    description: 'Retrieves the current user\'s notification preferences',
    security: [{ sessionAuth: [] }],
    responses: {
      200: {
        description: 'User notification preferences',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                notificationChannels: { type: 'array', items: { type: 'string', enum: ['EMAIL', 'PUSH'] } },
                notificationPreferences: { type: 'array', items: { type: 'string', enum: ['BOOKING_UPDATES', 'ADMIN_NEW_BOOKINGS'] } }
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
  // Require authentication
  const sessionUser = await requireAuth(event)

  // Fetch user preferences from database
  const user = firstRow(await db
    .select({
      notificationChannels: schema.users.notificationChannels,
      notificationPreferences: schema.users.notificationPreferences
    })
    .from(schema.users)
    .where(eq(schema.users.id, sessionUser.id))
    .limit(1))

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // Parse JSON strings to arrays
  return {
    notificationChannels: JSON.parse(user.notificationChannels),
    notificationPreferences: JSON.parse(user.notificationPreferences)
  }
})
