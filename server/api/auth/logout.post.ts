/**
 * User Logout Endpoint
 *
 * Invalidates the current user session.
 *
 * Process:
 * 1. Clear user session using clearUserSession()
 * 2. Return success message
 *
 * Response:
 * - 200: { message: "Logged out successfully" }
 *
 * Uses nuxt-auth-utils:
 * - clearUserSession(event)
 *
 * @method POST
 * @route /api/auth/logout
 * @authenticated
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event)

  return {
    message: 'Logged out successfully'
  }
})
