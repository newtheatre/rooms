/**
 * Unsubscribe from Push Notifications Endpoint
 *
 * Removes a web push notification subscription for the current user.
 *
 * Request Body:
 * - endpoint: string (push service URL)
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Find subscription by endpoint and userId
 * 3. Delete subscription from database
 * 4. Return success message
 *
 * Response:
 * - 200: { message: "Unsubscribed successfully" }
 * - 400: Validation error
 * - 401: Not authenticated
 * - 404: Subscription not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method POST
 * @route /api/notifications/unsubscribe
 * @authenticated
 */
import prisma from '~~/server/database'

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

  const db = prisma

  // Parse and validate request body
  const { endpoint } = await readValidatedBody(event, pushUnsubscribeSchema.parse)

  // Find subscription
  const subscription = await db.pushSubscription.findUnique({
    where: { endpoint }
  })

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
  await db.pushSubscription.delete({
    where: { endpoint }
  })

  return {
    message: 'Unsubscribed successfully'
  }
})
