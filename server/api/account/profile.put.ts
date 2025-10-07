/**
 * Update User Profile Endpoint
 *
 * Updates the current user's name and/or email.
 *
 * Request Body:
 * - name?: string (optional)
 * - email?: string (optional, validated email format)
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Validate request body
 * 3. Check if new email already exists (if changing email)
 * 4. Update user record in database
 * 5. Update session if email changed
 * 6. Return updated user data
 *
 * Response:
 * - 200: { id, email, name, role }
 * - 400: Validation error
 * - 401: Not authenticated
 * - 409: Email already exists
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - replaceUserSession(event, { user: updatedUser })
 *
 * @method PUT
 * @route /api/account/profile
 * @authenticated
 */
import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  // Require authentication
  const sessionUser = await requireAuth(event)

  const db = prisma

  // Parse and validate request body
  const data = await readValidatedBody(event, updateProfileSchema.parse)

  // If email is being changed, check for duplicates
  if (data.email && data.email !== sessionUser.email) {
    const existingUser = await db.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      throw createError({
        statusCode: 409,
        message: 'Email already in use'
      })
    }
  }

  // Update user profile
  const updatedUser = await db.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email })
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })

  // Update session with new user data
  await replaceUserSession(event, {
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role
    }
  })

  return updatedUser
})
