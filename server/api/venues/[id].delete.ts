/**
 * Permanently remove an external venue. Refused while any booking references
 * it — there is no deactivated state, unlike rooms.
 */

import prisma from '~~/server/database'

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

  // Check if venue has bookings
  if (venue._count.bookings > 0) {
    throw createError({
      statusCode: 400,
      message: `Cannot delete venue with ${venue._count.bookings} associated booking(s). Please reassign or cancel bookings first.`
    })
  }

  // Hard delete - venues can be deleted if no bookings exist
  await prisma.externalVenue.delete({
    where: { id }
  })

  return { message: 'Venue deleted successfully' }
})
