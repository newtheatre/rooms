/**
 * PUT /api/venues/:id — update an external venue. Admin only. Partial body.
 */

import { createVenueSchema } from '../../utils/validation'
import prisma from '../../database'

defineRouteMeta({
  openAPI: {
    tags: ['Venues'],
    summary: 'Update external venue',
    description: 'Updates an external venue record (admin only)',
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
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
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
      200: {
        description: 'Venue updated successfully',
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
      400: { description: 'Validation error or invalid venue ID' },
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

  const body = await readBody(event)

  // Validate using partial schema (all fields optional for update)
  const updateSchema = createVenueSchema.partial()
  const validation = updateSchema.safeParse(body)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.error.issues[0].message
    })
  }

  // Check if venue exists
  const existing = await prisma.externalVenue.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Venue not found'
    })
  }

  const venue = await prisma.externalVenue.update({
    where: { id },
    data: validation.data,
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  return {
    ...venue,
    bookingCount: venue._count.bookings
  }
})
