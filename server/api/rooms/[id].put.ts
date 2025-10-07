/**
 * Update Room Endpoint
 *
 * Updates an internal rehearsal room.
 * Admin-only endpoint.
 *
 * Request Body (all optional):
 * - name?: string
 * - description?: string
 * - capacity?: number
 * - isActive?: boolean
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse room ID from route params
 * 3. Validate request body
 * 4. Fetch existing room
 * 5. Update room in database
 * 6. Return updated room
 *
 * Response:
 * - 200: Updated room object
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Room not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method PUT
 * @route /api/rooms/[id]
 * @authenticated
 * @admin-only
 */

import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid room ID'
    })
  }

  const body = await readValidatedBody(event, createRoomSchema.partial().parse)

  // Check if room exists
  const existing = await prisma.room.findUnique({ where: { id } })
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  const room = await prisma.room.update({
    where: { id },
    data: body,
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  return {
    ...room,
    bookingCount: room._count.bookings
  }
})
