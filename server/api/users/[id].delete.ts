/**
 * Delete User Endpoint
 *
 * Deletes a user account.
 * Admin-only endpoint.
 *
 * Important: When a user is deleted:
 * - bookings.userId is set to NULL (preserves booking history)
 * - Push subscriptions are deleted (CASCADE)
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse user ID from route params
 * 3. Prevent admin from deleting their own account
 * 4. Send deletion notification to user
 * 5. Delete user from database (Prisma handles CASCADE and SET NULL)
 * 6. Return success message
 *
 * Response:
 * - 200: { message: "User deleted successfully" }
 * - 400: Attempting to delete own account
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: User not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method DELETE
 * @route /api/users/[id]
 * @authenticated
 * @admin-only
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Delete user',
    description: 'Deletes a user account (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string' },
        description: 'User ID'
      }
    ],
    responses: {
      200: {
        description: 'User deleted successfully',
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
      400: { description: 'Cannot delete own account' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin or cannot delete admin accounts' },
      404: { description: 'User not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin authentication
  const sessionUser = await requireAdmin(event)

  const db = prisma

  // Get user ID from route params
  const userId = getRouterParam(event, 'id')

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  // Prevent admin from deleting their own account
  if (userId === sessionUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete your own account. Use /api/account/delete to delete your own account'
    })
  }

  // Check if user exists
  const existingUser = await db.user.findUnique({
    where: { id: userId }
  })

  if (!existingUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // Prevent deletion of admin accounts
  // Another admin must demote them to STANDARD first
  if (existingUser.role === 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: 'Admin accounts cannot be deleted. Change their role to STANDARD first.'
    })
  }

  // Send deletion notification before deleting
  const notificationContent = `
    Your account has been deleted by an administrator.
    
    All your personal information has been removed, but your booking history has been preserved for record-keeping purposes.
    
    If you have questions about this action, please contact an administrator.
    
    Time: ${new Date().toLocaleString()}
  `

  // Send email before deletion (await this one to ensure it goes out)
  await sendCriticalNotification(
    existingUser,
    'Account Deleted by Administrator - Room Booking System',
    notificationContent
  ).catch((err) => {
    console.error('Failed to send admin account deletion notification:', err)
  })

  // Delete user (CASCADE will handle push subscriptions, SET NULL for bookings)
  await db.user.delete({
    where: { id: userId }
  })

  return {
    message: 'User deleted successfully'
  }
})
