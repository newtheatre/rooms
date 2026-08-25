/**
 * PUT /api/account/preferences: update the caller's notification channels and
 * types. Account-security mail ignores both.
 */
import { db, schema } from '@nuxthub/db'
import { and, eq, isNull } from 'drizzle-orm'

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
              notificationPreferences: { type: 'array', items: { type: 'string', enum: ['BOOKING_UPDATES', 'ADMIN_NEW_BOOKINGS'] } }
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
      401: { description: 'Not authenticated' },
      409: { description: 'Account erased' }
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

  // An erased row is never written back over, whichever caller asks (ADR-0005).
  const updatedUser = firstRow(await db
    .update(schema.users)
    .set({
      ...(data.notificationChannels && {
        notificationChannels: JSON.stringify(data.notificationChannels)
      }),
      ...(data.notificationPreferences && {
        notificationPreferences: JSON.stringify(data.notificationPreferences)
      })
    })
    .where(and(
      eq(schema.users.id, sessionUser.id),
      isNull(schema.users.anonymisedAt)
    ))
    .returning({
      notificationChannels: schema.users.notificationChannels,
      notificationPreferences: schema.users.notificationPreferences
    }))

  // The sealed cookie outlives erasure, so this is reachable (ADR-0005).
  if (!updatedUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Account erased',
      message: 'That account has been erased, so its notification settings can no longer be changed.'
    })
  }

  // Return parsed JSON
  return {
    notificationChannels: JSON.parse(updatedUser.notificationChannels),
    notificationPreferences: JSON.parse(updatedUser.notificationPreferences)
  }
})
