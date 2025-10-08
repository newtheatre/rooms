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

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Reset user password',
    description: 'Resets a user\'s password (admin only)',
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
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['password'],
            properties: {
              password: { type: 'string', description: 'New password (min 8 chars)' }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Password reset successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Validation error or attempting to change own password' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      404: { description: 'User not found' }
    }
  }
})

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
