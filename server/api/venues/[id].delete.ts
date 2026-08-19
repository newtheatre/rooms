/**
 * Permanently remove an external venue. Refused while any booking references
 * it; there is no deactivated state, unlike rooms.
 */

import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Venues'],
    summary: 'Delete external venue',
    description: 'Hard-deletes an external venue record (admin only)',
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
        description: 'Venue deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        }
      },
      400: { description: 'Venue has associated bookings or invalid venue ID' },
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

  // Check if venue exists
  const venue = firstRow(await db
    .select({ id: schema.externalVenues.id })
    .from(schema.externalVenues)
    .where(eq(schema.externalVenues.id, id))
    .limit(1))

  if (!venue) {
    throw createError({
      statusCode: 404,
      message: 'Venue not found'
    })
  }

  // Check if venue has bookings
  const bookings = firstRow(await db
    .select({ value: count() })
    .from(schema.bookings)
    .where(eq(schema.bookings.externalVenueId, id)))

  const bookingCount = bookings?.value ?? 0
  if (bookingCount > 0) {
    throw createError({
      statusCode: 400,
      message: `Cannot delete venue with ${bookingCount} associated booking(s). Please reassign or cancel bookings first.`
    })
  }

  // Hard delete - venues can be deleted if no bookings exist
  await db.delete(schema.externalVenues).where(eq(schema.externalVenues.id, id))

  return { message: 'Venue deleted successfully' }
})
