/**
 * User Login Endpoint
 *
 * Authenticates a user with email/password.
 *
 * Request Body:
 * - email: string
 * - password: string
 *
 * Process:
 * 1. Validate request body with loginSchema using readValidatedBody
 * 2. Find user by email
 * 3. Verify password using verifyPassword() from nuxt-auth-utils
 * 4. Create session using setUserSession()
 * 5. Return user data
 *
 * Response:
 * - 200: { id, email, name, role }
 * - 400: Validation error
 * - 401: Invalid credentials
 *
 * Uses nuxt-auth-utils:
 * - verifyPassword(hash, password)
 * - setUserSession(event, { user: { id, email, name, role } })
 *
 * @method POST
 * @route /api/auth/login
 * @public
 */
import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  const db = prisma

  // Parse and validate request body with runtime type safety
  const { email, password } = await readValidatedBody(event, loginSchema.parse)

  // Find user by email
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true
    }
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password'
    })
  }

  // Verify password
  const isValidPassword = await verifyPassword(user.passwordHash, password)

  if (!isValidPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password'
    })
  }

  // Create session
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  })

  // Return user data (without password)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
})
