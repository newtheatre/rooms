/**
 * PUT /api/account/preferences — update the caller's notification channels and
 * types. Account-security mail ignores both.
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Account'],
    summary: 'Update notification preferences',
    description: 'Updates the current user\'s notification preferences',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
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
    responses: {
      200: {
        description: 'Preferences updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                notificationChannels: { type: 'array', items: { type: 'string' } },
                notificationPreferences: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const sessionUser = await requireAuth(event)

  const db = prisma

  // Parse and validate request body
  const data = await readValidatedBody(event, updatePreferencesSchema.parse)

  // Update user preferences
  const updatedUser = await db.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(data.notificationChannels && {
        notificationChannels: JSON.stringify(data.notificationChannels)
      }),
      ...(data.notificationPreferences && {
        notificationPreferences: JSON.stringify(data.notificationPreferences)
      })
    },
    select: {
      notificationChannels: true,
      notificationPreferences: true
    }
  })

  // Return parsed JSON
  return {
    notificationChannels: JSON.parse(updatedUser.notificationChannels),
    notificationPreferences: JSON.parse(updatedUser.notificationPreferences)
  }
})
