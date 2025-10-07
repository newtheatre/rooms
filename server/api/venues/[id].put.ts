/**
 * Update External Venue Endpoint
 *
 * Updates an external venue record.
 * Admin-only endpoint.
 *
 * Request Body (all optional):
 * - campus?: string
 * - building?: string
 * - roomName?: string
 * - contactDetails?: string
 *
 * Process:
 * 1. Require admin authentication
 * 2. Parse venue ID from route params
 * 3. Validate request body
 * 4. Fetch existing venue
 * 5. Update venue in database
 * 6. Return updated venue
 *
 * Response:
 * - 200: Updated venue object
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not admin
 * - 404: Venue not found
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 * - Check user.role === 'ADMIN'
 *
 * @method PUT
 * @route /api/venues/[id]
 * @authenticated
 * @admin-only
 */

import { createVenueSchema } from '../../utils/validation'
import prisma from '../../database'

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
