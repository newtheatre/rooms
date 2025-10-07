/**
 * Update User Endpoint
 *
 * Updates a user account (primarily for role changes).
 * Admin-only endpoint.
 *
 * Request Body:
 * - role?: Role (ADMIN or STANDARD)
 * - name?: string
 * - email?: string
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse user ID from route params
 * 3. Prevent admin from changing their own role (security safeguard)
 * 4. Validate request body
 * 5. Check if new email already exists (if changing email)
 * 6. Update user in database
 * 7. Return updated user
 *
 * Response:
 * - 200: Updated user object (without passwordHash)
 * - 400: Validation error or attempting to change own role
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: User not found
 * - 409: Email already exists
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method PUT
 * @route /api/users/[id]
 * @authenticated
 * @admin-only
 */
import prisma from '../../database'
import { updateUserSchema } from '../../utils/validation'

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

  // Prevent admin from changing their own role
  if (userId === sessionUser.id) {
    throw createError({
      statusCode: 400,
      message: 'Cannot change your own role'
    })
  }

  // Parse and validate request body
  const data = await readValidatedBody(event, updateUserSchema.parse)

  // Check for existing user
  const existingUser = await db.user.findUnique({
    where: { id: userId }
  })

  if (!existingUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  // If email is being changed, check for duplicates
  if (data.email && data.email !== existingUser.email) {
    const emailExists = await db.user.findUnique({
      where: { email: data.email }
    })

    if (emailExists) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Email already in use'
      })
    }
  }

  // Update user
  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(data.role && { role: data.role })
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    }
  })

  return updatedUser
})
