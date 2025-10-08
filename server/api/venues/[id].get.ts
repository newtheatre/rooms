/**
 * Get External Venue Details Endpoint
 *
 * Retrieves details for a specific external venue.
 * Admin-only endpoint.
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse venue ID from route params
 * 3. Fetch venue from database
 * 4. Optionally include bookings for this venue
 * 5. Return venue details
 *
 * Response:
 * - 200: Venue object
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Venue not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method GET
 * @route /api/venues/[id]
 * @authenticated
 * @admin-only
 */

import prisma from '../../database'

defineRouteMeta({
  openAPI: {
    tags: ['Venues'],
    summary: 'Get venue details',
    description: 'Retrieves details for a specific external venue (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Venue ID'
      }
    ],
    responses: {
      200: {
        description: 'Venue details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                campus: { type: 'string', nullable: true },
                building: { type: 'string' },
                roomName: { type: 'string' },
                contactDetails: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                bookingCount: { type: 'integer' }
              }
            }
          }
        }
      },
      400: { description: 'Invalid venue ID' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      404: { description: 'Venue not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid venue ID'
    })
  }

  const venue = await prisma.externalVenue.findUnique({
    where: { id },
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  if (!venue) {
    throw createError({
      statusCode: 404,
      message: 'Venue not found'
    })
  }

  return {
    ...venue,
    bookingCount: venue._count.bookings
  }
})
