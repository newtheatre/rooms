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
