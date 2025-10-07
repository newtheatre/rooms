/**
 * PUT /api/users/:id/password
 *
 * Reset a user's password (admin only).
 *
 * Request body:
 * - password: string (8+ chars)
 *
 * Returns: Success message
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: User is not an admin
 * - 404: User not found
 * - 400: Validation error or attempting to change own password
 */
import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  // Require authenticated admin user
  const { user: sessionUser } = await requireUserSession(event)

  if (sessionUser.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required'
    })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID required'
    })
  }

  // Prevent admins from changing their own password via this endpoint
  if (userId === sessionUser.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use the account settings to change your own password'
    })
  }

  // Validate request body
  const { password } = await readValidatedBody(event, resetPasswordSchema.parse)

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // Hash and update password
  const passwordHash = await hashPassword(password)

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  })

  return {
    success: true,
    message: 'Password reset successfully'
  }
})
