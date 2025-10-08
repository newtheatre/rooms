/**
 * List External Venues Endpoint
 *
 * Retrieves all external venue records.
 * Admin-only endpoint.
 *
 * Query Parameters:
 * - campus?: string (filter by campus)
 * - building?: string (filter by building)
 *
 * Process:
 * 1. Require admin authentication
 * 2. Build query filters from query params
 * 3. Fetch venues from database
 * 4. Optionally include booking count per venue
 * 5. Return venues array
 *
 * Response:
 * - 200: Array of venue objects
 * - 401: Not authenticated
 * - 403: Not admin
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method GET
 * @route /api/venues
 * @authenticated
 * @admin-only
 */

import prisma from '../../database'

defineRouteMeta({
  openAPI: {
    tags: ['Venues'],
    summary: 'List external venues',
    description: 'Retrieves all external venue records (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'campus',
        schema: { type: 'string' },
        description: 'Filter by campus'
      },
      {
        in: 'query',
        name: 'building',
        schema: { type: 'string' },
        description: 'Filter by building name'
      }
    ],
    responses: {
      200: {
        description: 'List of external venues',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
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
        }
      },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const campus = query.campus as string | undefined
  const building = query.building as string | undefined

  interface VenueWhere {
    campus?: string
    building?: { contains: string }
  }

  const where: VenueWhere = {}
  if (campus) where.campus = campus
  if (building) where.building = { contains: building }

  const venues = await prisma.externalVenue.findMany({
    where,
    include: {
      _count: {
        select: { bookings: true }
      }
    },
    orderBy: [
      { campus: 'asc' },
      { building: 'asc' },
      { roomName: 'asc' }
    ]
  })

  return venues.map(venue => ({
    ...venue,
    bookingCount: venue._count.bookings
  }))
})
