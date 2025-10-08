/**
 * Subscribe to Push Notifications Endpoint
 *
 * Registers a new web push notification subscription for the current user.
 *
 * Request Body:
 * - endpoint: string (push service URL)
 * - keys: {
 *     p256dh: string,
 *     auth: string
 *   }
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Validate request body with pushSubscriptionSchema
 * 3. Check if subscription already exists (by endpoint)
 * 4. Create push subscription record in database
 * 5. Return subscription confirmation
 *
 * Response:
 * - 201: { id, endpoint }
 * - 400: Validation error
 * - 401: Not authenticated
 * - 409: Subscription already exists
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method POST
 * @route /api/notifications/subscribe
 * @authenticated
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Notifications'],
    summary: 'Subscribe to push notifications',
    description: 'Registers a web push notification subscription for the current user',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['endpoint', 'keys'],
            properties: {
              endpoint: { type: 'string', format: 'uri', description: 'Push service endpoint URL' },
              keys: {
                type: 'object',
                required: ['p256dh', 'auth'],
                properties: {
                  p256dh: { type: 'string', description: 'p256dh key' },
                  auth: { type: 'string', description: 'Auth key' }
                }
              }
            }
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Subscription created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                endpoint: { type: 'string' }
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
  const user = await requireAuth(event)

  const db = prisma

  // Parse and validate request body
  const { endpoint, keys } = await readValidatedBody(event, pushSubscriptionSchema.parse)

  // Check if subscription already exists
  const existingSubscription = await db.pushSubscription.findUnique({
    where: { endpoint }
  })

  if (existingSubscription) {
    // If it belongs to the same user, return it
    if (existingSubscription.userId === user.id) {
      return {
        id: existingSubscription.id,
        endpoint: existingSubscription.endpoint
      }
    }

    // If it belongs to a different user, update it
    const updatedSubscription = await db.pushSubscription.update({
      where: { endpoint },
      data: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    })

    return {
      id: updatedSubscription.id,
      endpoint: updatedSubscription.endpoint
    }
  }

  // Create new subscription
  const subscription = await db.pushSubscription.create({
    data: {
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    }
  })

  // Set 201 status code
  setResponseStatus(event, 201)

  return {
    id: subscription.id,
    endpoint: subscription.endpoint
  }
})
