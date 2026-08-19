/**
 * POST /api/venues: create an external venue. Admin only.
 */

import { db, schema } from '@nuxthub/db'

defineRouteMeta({
  openAPI: {
    tags: ['Venues'],
    summary: 'Create external venue',
    description: 'Creates a new external venue record (admin only)',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['building', 'roomName'],
            properties: {
              campus: { type: 'string', description: 'Campus name' },
              building: { type: 'string', description: 'Building name' },
              roomName: { type: 'string', description: 'Room name' },
              contactDetails: { type: 'string', description: 'Contact details' }
            }
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Venue created successfully',
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
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, createVenueSchema.parse)

  const { campus, building, roomName, contactDetails } = body

  const venue = requireRow(await db
    .insert(schema.externalVenues)
    .values({ campus, building, roomName, contactDetails })
    .returning())

  setResponseStatus(event, 201)

  // A new venue has no bookings yet.
  return { ...venue, bookingCount: 0 }
})
