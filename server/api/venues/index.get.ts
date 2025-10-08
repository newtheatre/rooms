/**
 * List External Venues Endpoint
 *
 * Retrieves all external venue records.
 * - Regular users: Get basic venue info (id, campus, building, roomName, contactDetails)
 * - Admins: Get full details including creation date and booking counts
 *
 * Query Parameters:
 * - campus?: string (filter by campus)
 * - building?: string (filter by building)
 *
 * Process:
 * 1. Require authentication
 * 2. Check user role
 * 3. Build query filters from query params
 * 4. Fetch venues from database
 * 5. Return full data for admins, limited data for users
 *
 * Response:
 * - 200: Array of venue objects (full for admin, limited for users)
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method GET
 * @route /api/venues
 * @authenticated
 */

import prisma from '../../database'

defineRouteMeta({
  openAPI: {
    tags: ['Venues'],
    summary: 'List external venues',
    description: 'Retrieves external venue records (all users can view, admins see full details)',
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
                  createdAt: { type: 'string', format: 'date-time', description: 'Admin only' },
                  bookingCount: { type: 'integer', description: 'Admin only' }
                }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication but allow all users
  const user = await requireAuth(event)

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

  const isAdmin = user.role === 'ADMIN'

  const venues = await prisma.externalVenue.findMany({
    where,
    include: {
      _count: isAdmin
        ? {
            select: { bookings: true }
          }
        : undefined
    },
    orderBy: [
      { campus: 'asc' },
      { building: 'asc' },
      { roomName: 'asc' }
    ]
  })

  // Return full data for admins, limited data for regular users
  if (isAdmin) {
    return venues.map(venue => ({
      ...venue,
      bookingCount: venue._count?.bookings || 0
    }))
  } else {
    // Regular users only get basic info
    return venues.map(venue => ({
      id: venue.id,
      campus: venue.campus,
      building: venue.building,
      roomName: venue.roomName,
      contactDetails: venue.contactDetails
    }))
  }
})
