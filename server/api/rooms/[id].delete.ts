/**
 * Delete Room Endpoint
 *
 * Soft-deletes a room by setting isActive to false.
 * Admin-only endpoint.
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse room ID from route params
 * 3. Fetch room from database
 * 4. Set isActive to false (soft delete - preserves booking history)
 * 5. Return success message
 *
 * Response:
 * - 200: { message: "Room deactivated successfully" }
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

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number.parseInt(event.context.params?.id || '')
  if (Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid room ID'
    })
  }

  // Check if room exists
  const room = await prisma.room.findUnique({ where: { id } })
  if (!room) {
    throw createError({
      statusCode: 404,
      message: 'Room not found'
    })
  }

  // Soft delete - set isActive to false
  await prisma.room.update({
    where: { id },
    data: { isActive: false }
  })

  return { message: 'Room deactivated successfully' }
})
