/**
 * Get User Profile Endpoint
 *
 * Retrieves the current user's profile information.
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Fetch full user record from database
 * 3. Return user data (exclude passwordHash)
 *
 * Response:
 * - 200: { id, email, name, role, createdAt }
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method GET
 * @route /api/account/profile
 * @authenticated
 */
import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  // Require authentication
  const sessionUser = await requireAuth(event)

  const db = prisma

  // Fetch full user profile from database
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  return user
})
