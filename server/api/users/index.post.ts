/**
 * POST /api/users
 *
 * Create a new user account (admin only).
 *
 * Request body:
 * - name: string (1-255 chars)
 * - email: string (valid email, unique)
 * - role: 'ADMIN' | 'STANDARD'
 * - password: string (8+ chars) - optional, will be auto-generated if not provided
 *
 * Returns: Created user object with password field if auto-generated
 *
 * Errors:
 * - 401: Not authenticated
 * - 403: User is not an admin
 * - 409: Email already exists
 * - 400: Validation error
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Create user',
    description: 'Creates a new user account (admin only)',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'email', 'role'],
            properties: {
              name: { type: 'string', description: 'User name' },
              email: { type: 'string', format: 'email', description: 'User email' },
              role: { type: 'string', enum: ['ADMIN', 'STANDARD'], description: 'User role' },
              password: { type: 'string', description: 'Password (optional, will be auto-generated if not provided)' }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'User created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                bookingCount: { type: 'integer' },
                password: { type: 'string', description: 'Auto-generated password (only returned if password was not provided)' }
              }
            }
          }
        }
      },
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      409: { description: 'Email already exists' }
    }
  }
})

function generatePassword() {
  // Generate a random password with uppercase, lowercase, numbers, and symbols
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default defineEventHandler(async (event) => {
  // Require authenticated admin user
  await requireAdmin(event)

  // Validate request body
  const body = await readValidatedBody(event, createUserSchema.parse)

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: body.email }
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email already in use'
    })
  }

  // Use provided password or generate a secure one
  const password = body.password || generatePassword()
  const passwordHash = await hashPassword(password)
  const wasGenerated = !body.password

  // Create user with default notification preferences
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      role: body.role,
      passwordHash,
      notificationChannels: JSON.stringify(['EMAIL']),
      notificationPreferences: JSON.stringify(['BOOKING_UPDATES'])
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true
    }
  })

  // Get booking count (will be 0 for new users)
  const bookingCount = 0

  return {
    ...user,
    bookingCount,
    // Return the password if it was auto-generated so it can be copied to clipboard
    ...(wasGenerated ? { password } : {})
  }
})
