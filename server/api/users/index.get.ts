/**
 * GET /api/users — list local user mirrors. Admin only.
 *
 * Identity lives in the central auth service; this is the app-side mirror, for
 * attaching a booking to someone. `search` matches name and email.
 */
import prisma from '~~/server/database'
import type { Prisma } from '@prisma/client'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'List users',
    description: 'Retrieves all user accounts (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
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

  // Parse query parameters. Roles now live in the central auth service —
  // this mirror table has no role column to filter by.
  const query = getQuery(event)
  const searchFilter = query.search as string | undefined

  // Build where clause
  const where: Prisma.UserWhereInput = {}

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
    createdAt: user.createdAt,
    bookingCount: user._count.bookings
  }))
})
