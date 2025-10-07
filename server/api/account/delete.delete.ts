/**
 * Delete Account Endpoint
 *
 * Allows users to delete their own account.
 * This is a destructive action that cannot be undone.
 *
 * Process:
 * 1. Require user authentication
 * 2. Delete user's push subscriptions (cascade)
 * 3. Set bookings.userId to NULL (preserve booking history)
 * 4. Delete user account
 * 5. Clear session
 *
 * Response:
 * - 200: { message: "Account deleted successfully" }
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - clearUserSession(event)
 *
 * @method DELETE
 * @route /api/account/delete
 * @authenticated
 */

import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Prevent admins from deleting their own account
  // Another admin must demote them to STANDARD first
  if (user.role === 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: 'Admin accounts cannot be deleted. Another admin must demote you to a standard user first.'
    })
  }

  try {
    // Delete user account
    // Push subscriptions will be cascade deleted
    // Bookings will have userId set to NULL (onDelete: SetNull in schema)
    await prisma.user.delete({
      where: { id: user.id }
    })

    // Clear the session
    await clearUserSession(event)

    return { message: 'Account deleted successfully' }
  } catch (error) {
    console.error('Error deleting account:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to delete account'
    })
  }
})
