/**
 * Change Password Endpoint
 *
 * Changes the current user's password.
 *
 * Request Body:
 * - currentPassword: string
 * - newPassword: string (validated with passwordSchema)
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Validate request body
 * 3. Verify current password
 * 4. Hash new password
 * 5. Update password in database
 * 6. Send security notification email
 * 7. Return success message
 *
 * Response:
 * - 200: { message: "Password updated successfully" }
 * - 400: Validation error
 * - 401: Not authenticated or invalid current password
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - verifyPassword(hash, currentPassword)
 * - hashPassword(newPassword)
 *
 * @method PUT
 * @route /api/account/password
 * @authenticated
 */
import prisma from '~~/server/database'
import { sendCriticalNotification } from '~~/server/utils/notifications'

defineRouteMeta({
  openAPI: {
    tags: ['Account'],
    summary: 'Change password',
    description: 'Changes the current user\'s password',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['currentPassword', 'newPassword'],
            properties: {
              currentPassword: { type: 'string', description: 'Current password' },
              newPassword: { type: 'string', description: 'New password (min 8 chars, must contain uppercase, lowercase, and number)' }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Password updated successfully',
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
      401: { description: 'Not authenticated or invalid current password' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const sessionUser = await requireAuth(event)

  const db = prisma

  // Parse and validate request body
  const { currentPassword, newPassword } = await readValidatedBody(event, changePasswordSchema.parse)

  // Fetch user with password hash
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      passwordHash: true
    }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // Verify current password
  const isValidPassword = await verifyPassword(user.passwordHash, currentPassword)

  if (!isValidPassword) {
    throw createError({
      statusCode: 401,
      message: 'Current password is incorrect'
    })
  }

  // Check that new password is different from current
  const isSamePassword = await verifyPassword(user.passwordHash, newPassword)

  if (isSamePassword) {
    throw createError({
      statusCode: 400,
      message: 'New password must be different from current password'
    })
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword)

  // Update password in database
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash
    }
  })

  // Fetch full user record for notification
  const fullUser = await db.user.findUnique({
    where: { id: user.id }
  })

  if (fullUser) {
    // Send security notification (async, don't await)
    const notificationContent = `
      Your password was recently changed.
      
      If you did not make this change, please contact support immediately.
      
      Time: ${new Date().toLocaleString()}
    `

    sendCriticalNotification(
      fullUser,
      'Password Changed - Room Booking System',
      notificationContent
    ).catch((err) => {
      console.error('Failed to send password change notification:', err)
    })
  }

  return {
    message: 'Password updated successfully'
  }
})
