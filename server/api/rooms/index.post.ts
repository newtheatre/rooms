/**
 * Create Room Endpoint
 *
 * Creates a new internal rehearsal room.
 * Admin-only endpoint.
 *
 * Request Body:
 * - name: string
 * - description?: string
 * - capacity?: number
 * - isActive?: boolean (default: true)
 *
 * Process:
 * 1. Require admin authentication
 * 2. Validate request body with createRoomSchema
 * 3. Create room in database
 * 4. Return created room
 *
 * Response:
 * - 201: Room object
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not admin
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method POST
 * @route /api/rooms
 * @authenticated
 * @admin-only
 */

import prisma from '~~/server/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(event, createRoomSchema.parse)

  const { name, description, capacity, isActive } = body

  const room = await prisma.room.create({
    data: {
      name,
      description,
      capacity,
      isActive
    },
    include: {
      _count: {
        select: { bookings: true }
      }
    }
  })

  setResponseStatus(event, 201)
  return {
    ...room,
    bookingCount: room._count.bookings
  }
})
