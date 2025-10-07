/**
 * Update User Preferences Endpoint
 *
 * Updates the current user's notification preferences.
 *
 * Request Body:
 * - notificationChannels?: ["EMAIL" | "PUSH"]
 * - notificationPreferences?: ["BOOKING_UPDATES"]
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Validate request body with updatePreferencesSchema
 * 3. Stringify JSON arrays
 * 4. Update user record in database
 * 5. Return updated preferences
 *
 * Response:
 * - 200: {
 *     notificationChannels: ["EMAIL"],
 *     notificationPreferences: ["BOOKING_UPDATES"]
 *   }
 * - 400: Validation error
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method PUT
 * @route /api/account/preferences
 * @authenticated
 */
import prisma from '~~/server/database'

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
