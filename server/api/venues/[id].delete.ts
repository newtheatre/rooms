/**
 * Delete External Venue Endpoint
 *
 * Hard-deletes an external venue record.
 * Admin-only endpoint.
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse venue ID from route params
 * 3. Check if venue has any associated bookings
 * 4. If bookings exist, prevent deletion (or handle appropriately)
 * 5. Delete venue from database
 * 6. Return success message
 *
 * Response:
 * - 200: { message: "Venue deleted successfully" }
 * - 400: Venue has associated bookings
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Venue not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method DELETE
 * @route /api/venues/[id]
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
