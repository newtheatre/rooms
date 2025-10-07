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
 * 6. Return success message
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

  return {
    message: 'Password updated successfully'
  }
})
