/**
 * GET /api/venues — list external venues. Admins also get creation dates and
 * booking counts. Filters: campus, building.
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

  const isAdmin = hasRole(user, 'rooms', 'ADMIN')

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
