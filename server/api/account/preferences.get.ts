/**
 * Get User Preferences Endpoint
 *
 * Retrieves the current user's notification preferences.
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Fetch user record from database
 * 3. Parse JSON notification fields
 * 4. Return preferences
 *
 * Response:
 * - 200: {
 *     notificationChannels: ["EMAIL", "PUSH"],
 *     notificationPreferences: ["BOOKING_UPDATES"]
 *   }
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method GET
 * @route /api/account/preferences
 * @authenticated
 */
import prisma from '~~/server/database'

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
                notificationPreferences: { type: 'array', items: { type: 'string', enum: ['BOOKING_UPDATES'] } }
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

  const db = prisma

  // Fetch user preferences from database
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      notificationChannels: true,
      notificationPreferences: true
    }
  })

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
