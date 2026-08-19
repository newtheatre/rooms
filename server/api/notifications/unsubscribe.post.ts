/**
 * POST /api/notifications/unsubscribe: drop a Web Push subscription by
 * endpoint. The caller may only remove their own.
 */
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Notifications'],
    summary: 'Unsubscribe from push notifications',
    description: 'Removes a web push notification subscription for the current user',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['endpoint'],
            properties: {
              endpoint: { type: 'string', format: 'uri', description: 'Push service endpoint URL' }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Unsubscribed successfully',
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
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' },
      403: { description: 'Forbidden' },
      404: { description: 'Subscription not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  // Parse and validate request body
  const { endpoint } = await readValidatedBody(event, pushUnsubscribeSchema.parse)

  // Find subscription
  const subscription = firstRow(await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))
    .limit(1))

  if (!subscription) {
    throw createError({
      statusCode: 404,
      message: 'Subscription not found'
    })
  }

  // Verify the subscription belongs to the current user
  if (subscription.userId !== user.id) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to delete this subscription'
    })
  }

  // Delete subscription
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, endpoint))

  return {
    message: 'Unsubscribed successfully'
  }
})
