/**
 * Delete Room Endpoint
 *
 * Deletes a room permanently or soft-deletes by setting isActive to false.
 * Admin-only endpoint.
 *
 * Query Parameters:
 * - permanent?: boolean (default: false, permanently delete the room)
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse room ID from route params
 * 3. Check query param for permanent deletion
 * 4. Fetch room from database
 * 5. Either hard delete or set isActive to false
 * 6. Return success message
 *
 * Response:
 * - 200: { message: "Room deleted/deactivated successfully" }
 * - 400: Invalid room ID or room has bookings (for permanent delete)
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Room not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method DELETE
 * @route /api/rooms/[id]
 * @authenticated
 * @admin-only
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
