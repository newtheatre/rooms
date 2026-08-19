/**
 * PUT /api/account/preferences: update the caller's notification channels and
 * types. Account-security mail ignores both.
 */
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

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

  // Parse and validate request body
  const data = await readValidatedBody(event, updatePreferencesSchema.parse)

  if (!data.notificationChannels && !data.notificationPreferences) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No changes supplied',
      message: 'Provide notificationChannels, notificationPreferences, or both.'
    })
  }

  // Update user preferences
  const updatedUser = requireRow(await db
    .update(schema.users)
    .set({
      ...(data.notificationChannels && {
        notificationChannels: JSON.stringify(data.notificationChannels)
      }),
      ...(data.notificationPreferences && {
        notificationPreferences: JSON.stringify(data.notificationPreferences)
      })
    })
    .where(eq(schema.users.id, sessionUser.id))
    .returning({
      notificationChannels: schema.users.notificationChannels,
      notificationPreferences: schema.users.notificationPreferences
    }))

  // Return parsed JSON
  return {
    notificationChannels: JSON.parse(updatedUser.notificationChannels),
    notificationPreferences: JSON.parse(updatedUser.notificationPreferences)
  }
})
