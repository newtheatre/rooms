/**
 * GET /api/venues — list external venues. Admins also get creation dates and
 * booking counts. Filters: campus, building.
 */

import { db, schema } from '@nuxthub/db'
import { and, asc, count, eq, like } from 'drizzle-orm'

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
  await requireAuth(event)

  const { campus, building } = await getValidatedQuery(event, venueListQuerySchema.parse)

  const where = and(
    campus ? eq(schema.externalVenues.campus, campus) : undefined,
    building ? like(schema.externalVenues.building, `%${building}%`) : undefined
  )

  const order = [
    asc(schema.externalVenues.campus),
    asc(schema.externalVenues.building),
    asc(schema.externalVenues.roomName)
  ]

  const isAdmin = await canNow(event, 'room.read.inactive')

  // Non-admins get an explicit column list, never the whole row.
  if (!isAdmin) {
    return await db
      .select({
        id: schema.externalVenues.id,
        campus: schema.externalVenues.campus,
        building: schema.externalVenues.building,
        roomName: schema.externalVenues.roomName,
        contactDetails: schema.externalVenues.contactDetails
      })
      .from(schema.externalVenues)
      .where(where)
      .orderBy(...order)
  }

  return await db
    .select({
      id: schema.externalVenues.id,
      campus: schema.externalVenues.campus,
      building: schema.externalVenues.building,
      roomName: schema.externalVenues.roomName,
      contactDetails: schema.externalVenues.contactDetails,
      createdAt: schema.externalVenues.createdAt,
      bookingCount: count(schema.bookings.id)
    })
    .from(schema.externalVenues)
    .leftJoin(schema.bookings, eq(schema.bookings.externalVenueId, schema.externalVenues.id))
    .where(where)
    .groupBy(schema.externalVenues.id)
    .orderBy(...order)
})
