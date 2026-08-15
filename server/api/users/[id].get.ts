/**
 * GET /api/users/:id — one local user mirror, with their bookings. Admin only.
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'Get user details',
    description: 'Retrieves details for a specific user (admin only)',
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
    responses: {
      200: {
        description: 'User details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },

                createdAt: { type: 'string', format: 'date-time' },
                bookingCount: { type: 'integer' },
                recentBookings: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      },
      400: { description: 'Invalid user ID' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      404: { description: 'User not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdmin(event)

  const db = prisma

  // Get user ID from route params
  const userId = getRouterParam(event, 'id')

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }

  // Fetch user with bookings
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          bookings: true
        }
      },
      bookings: {
        take: 5,
        orderBy: {
          startTime: 'desc'
        },
        select: {
          id: true,
          eventTitle: true,
          startTime: true,
          endTime: true,
          status: true
        }
      }
    }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    bookingCount: user._count.bookings,
    recentBookings: user.bookings
  }
})
