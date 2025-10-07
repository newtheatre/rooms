/**
 * User Registration Endpoint
 *
 * Creates a new user account with email/password authentication.
 *
 * Request Body:
 * - email: string (validated email format)
 * - name: string (1-255 characters)
 * - password: string (min 8 chars, uppercase, lowercase, number)
 *
 * Process:
 * 1. Validate request body with registerSchema using readValidatedBody
 * 2. Check if email already exists
 * 3. Hash password using hashPassword() from nuxt-auth-utils
 * 4. Create user in database with role: STANDARD
 * 5. Set default notification preferences
 * 6. Create session using setUserSession()
 * 7. Return user data (without password hash)
 *
 * Response:
 * - 201: { id, email, name, role }
 * - 400: Validation error
 * - 409: Email already exists
 *
 * @method POST
 * @route /api/auth/register
 * @public
 */
import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  const db = prisma

  // Parse and validate request body with runtime type safety
  const { email, name, password } = await readValidatedBody(event, registerSchema.parse)

  // Check if email already exists
  const existingUser = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      message: 'An account with this email already exists'
    })
  }

  // Hash password
  const hashedPassword = await hashPassword(password)

  // Create user with default notification preferences
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash: hashedPassword,
      role: 'STANDARD',
      notificationChannels: JSON.stringify(['EMAIL']), // Default to email notifications
      notificationPreferences: JSON.stringify(['BOOKING_UPDATES']) // Default to booking updates
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })

  // Create session (auto-login after registration)
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  })

  // Set response status to 201 Created
  setResponseStatus(event, 201)

  // Return user data
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
})
