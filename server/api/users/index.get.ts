/**
 * List Users Endpoint
 *
 * Retrieves all user accounts.
 * Admin-only endpoint.
 *
 * Query Parameters:
 * - role?: Role (filter by role: ADMIN or STANDARD)
 * - search?: string (search by name or email)
 *
 * Process:
 * 1. Require admin authentication
 * 2. Build query filters from query params
 * 3. Fetch users from database (exclude passwordHash)
 * 4. Optionally include booking count per user
 * 5. Return users array
 *
 * Response:
 * - 200: Array of user objects (without passwordHash)
 * - 401: Not authenticated
 * - 403: Not admin
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method GET
 * @route /api/users
 * @authenticated
 * @admin-only
 */
import prisma from '../../database'
import type { Prisma } from '../../../.generated/client'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'List users',
    description: 'Retrieves all user accounts (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'role',
        schema: { type: 'string', enum: ['ADMIN', 'STANDARD'] },
        description: 'Filter by user role'
      },
      {
        in: 'query',
        name: 'search',
        schema: { type: 'string' },
        description: 'Search by name or email'
      }
    ],
    responses: {
      200: {
        description: 'List of users',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['ADMIN', 'STANDARD'] },
                  createdAt: { type: 'string', format: 'date-time' },
                  bookingCount: { type: 'integer' }
                }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdmin(event)

  const db = prisma

  // Parse query parameters
  const query = getQuery(event)
  const roleFilter = query.role as string | undefined
  const searchFilter = query.search as string | undefined

  // Build where clause
  const where: Prisma.UserWhereInput = {}

  if (roleFilter && (roleFilter === 'ADMIN' || roleFilter === 'STANDARD')) {
    where.role = roleFilter
  }

  if (searchFilter) {
    where.OR = [
      { name: { contains: searchFilter } },
      { email: { contains: searchFilter } }
    ]
  }

  // Fetch users with booking count
  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          bookings: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Transform to include bookingCount
  return users.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    bookingCount: user._count.bookings
  }))
})
