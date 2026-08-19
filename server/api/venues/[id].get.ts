/**
 * GET /api/venues/:id: one external venue. Admin only.
 */

import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'

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

  const venue = firstRow(await db
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
    .where(eq(schema.externalVenues.id, id))
    .groupBy(schema.externalVenues.id))

  if (!venue) {
    throw createError({
      statusCode: 404,
      message: 'Venue not found'
    })
  }

  return venue
})
