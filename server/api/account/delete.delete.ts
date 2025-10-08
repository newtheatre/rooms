/**
 * Delete Account Endpoint
 *
 * Allows users to delete their own account.
 * This is a destructive action that cannot be undone.
 *
 * Process:
 * 1. Require user authentication
 * 2. Send confirmation email
 * 3. Delete user's push subscriptions (cascade)
 * 4. Set bookings.userId to NULL (preserve booking history)
 * 5. Delete user account
 * 6. Clear session
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
import { sendCriticalNotification } from '~~/server/utils/notifications'

defineRouteMeta({
  openAPI: {
    tags: ['Account'],
    summary: 'Delete account',
    description: 'Deletes the current user\'s account (destructive action)',
    security: [{ sessionAuth: [] }],
    responses: {
      200: {
        description: 'Account deleted successfully',
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
      401: { description: 'Not authenticated' },
      403: { description: 'Admin accounts cannot be deleted' },
      500: { description: 'Failed to delete account' }
    }
  }
})

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
    // Fetch full user record for notification
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id }
    })

    // Send deletion confirmation email before deleting
    if (fullUser) {
      const notificationContent = `
        Your account has been successfully deleted from the Room Booking System.
        
        All your personal information has been removed, but your booking history has been preserved for record-keeping purposes.
        
        If you did not request this deletion, please contact support immediately.
        
        Time: ${new Date().toLocaleString()}
      `

      // Send email before deletion (await this one to ensure it goes out)
      await sendCriticalNotification(
        fullUser,
        'Account Deleted - Room Booking System',
        notificationContent
      ).catch((err) => {
        console.error('Failed to send account deletion notification:', err)
      })
    }

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
