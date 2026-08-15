/**
 * GET /api/bookings/:id — one booking with its relations. Owner or admin.
 */
import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Get booking details',
    description: 'Retrieves details for a specific booking (users can only view their own)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Booking ID'
      }
    ],
    responses: {
      200: {
        description: 'Booking details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                userId: { type: 'string', nullable: true },
                roomId: { type: 'integer', nullable: true },
                externalVenueId: { type: 'integer', nullable: true },
                eventTitle: { type: 'string' },
                numberOfAttendees: { type: 'integer', nullable: true },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time' },
                status: { type: 'string' },
                notes: { type: 'string', nullable: true },
                rejectionReason: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' },
      403: { description: 'Forbidden' },
      404: { description: 'Booking not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  const db = prisma

  // Parse booking ID from route params
  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid booking ID'
    })
  }

  // Fetch booking with relations
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      room: true,
      externalVenue: true
    }
  })

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: 'Booking not found'
    })
  }

  // Check authorization: user owns booking OR user is admin
  if (booking.userId !== user.id && !hasRole(user, 'rooms', 'ADMIN')) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this booking'
    })
  }

  return booking
})
