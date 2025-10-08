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

defineRouteMeta({
  openAPI: {
    tags: ['Account'],
    summary: 'Get user profile',
    description: 'Retrieves the current user\'s profile information',
    security: [{ sessionAuth: [] }],
    responses: {
      200: {
        description: 'User profile',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string', enum: ['ADMIN', 'STANDARD'] },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' },
      404: { description: 'User not found' }
    }
  }
})

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
