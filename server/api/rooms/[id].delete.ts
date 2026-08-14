/**
 * DELETE /api/rooms/:id — deactivate a room, or with `permanent=true` remove it.
 * Admin only.
 *
 * Permanent deletion is refused once the room has bookings; deactivating keeps
 * the booking history readable, which is why it is the default.
 */

import prisma from '~~/server/database'

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'Delete room',
    description: 'Permanently deletes or soft-deletes a room (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'integer' },
        description: 'Room ID'
      },
      {
        in: 'query',
        name: 'permanent',
        schema: { type: 'boolean' },
        description: 'Permanently delete the room'
      }
    ],
    responses: {
      200: {
        description: 'Room deleted/deactivated successfully',
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
      400: { description: 'Invalid room ID or room has bookings' },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' },
      404: { description: 'Room not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid room ID'
    })
  }

  const query = getQuery(event)
  const permanent = query.permanent === 'true'

  // Check if room exists
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  if (permanent) {
    // Check if room has bookings
    if (room._count.bookings > 0) {
      throw createError({
        statusCode: 400,
        message: 'Cannot permanently delete room with existing bookings. Deactivate it instead.'
      })
    }

    // Hard delete - permanently remove from database
    await prisma.room.delete({
      where: { id }
    })

    return { message: 'Room permanently deleted' }
  } else {
    // Soft delete - set isActive to false
    await prisma.room.update({
      where: { id },
      data: { isActive: false }
    })

    return { message: 'Room deactivated successfully' }
  }
})
