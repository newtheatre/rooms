/**
 * Bulk Update Bookings Endpoint
 *
 * Updates multiple bookings at once (admin only).
 * Accepts an array of booking updates with their IDs and update data.
 * More efficient than individual updates, especially for notification emails.
 * Groups notifications by user - each user receives one email with all their updates.
 *
 * Request Body:
 * - updates: Array of { id: number, data: UpdateData }
 *   where UpdateData contains:
 *     - roomId?: number
 *     - externalVenueId?: number
 *     - status?: BookingStatus
 *     - rejectionReason?: string
 *
 * Response:
 * - 200: { updated: number, bookings: Booking[] }
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Not authorized (admin only)
 * - 404: One or more bookings not found
 *
 * @method PUT
 * @route /api/bookings/bulk
 * @authenticated
 * @admin
 */
import prisma from '~~/server/database'
import { notifyBulkBookingUpdates, formatBookingDateTime } from '~~/server/utils/notifications'
import { z } from 'zod'

const bookingStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'])

const updateDataSchema = z.object({
  roomId: z.number().int().positive().optional(),
  externalVenueId: z.number().int().positive().optional(),
  status: bookingStatusSchema.optional(),
  rejectionReason: z.string().max(500).optional()
}).refine(
  (data) => {
    // Can't assign both room and external venue
    if (data.roomId && data.externalVenueId) {
      return false
    }
    return true
  },
  {
    message: 'Cannot assign both room and external venue',
    path: ['roomId']
  }
)

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number().int().positive(),
      data: updateDataSchema
    })
  ).min(1).max(100)
})

export default defineEventHandler(async (event) => {
  // Require admin session
  const { user } = await requireUserSession(event)
  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required'
    })
  }

  // Parse and validate body
  const body = await readBody(event)
  const validation = bulkUpdateSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { updates } = validation.data

  // Extract all booking IDs
  const bookingIds = updates.map(u => u.id)

  // Fetch all bookings to verify they exist
  const existingBookings = await prisma.booking.findMany({
    where: {
      id: { in: bookingIds }
    },
    include: {
      user: true
    }
  })

  if (existingBookings.length !== bookingIds.length) {
    const foundIds = new Set(existingBookings.map(b => b.id))
    const missingIds = bookingIds.filter(id => !foundIds.has(id))
    throw createError({
      statusCode: 404,
      message: 'One or more bookings not found',
      data: { missingIds }
    })
  }

  // Create a map for quick lookup
  const existingBookingsMap = new Map(existingBookings.map(b => [b.id, b]))

  // Process all updates
  const updatedBookings = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifications: Array<{ user: any, booking: any, message: string }> = []

  for (const update of updates) {
    const existingBooking = existingBookingsMap.get(update.id)
    if (!existingBooking) continue

    const data = update.data

    // Track if status changed for notification
    const statusChanged = data.status && data.status !== existingBooking.status

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id: update.id },
      data: {
        ...(data.roomId !== undefined && { roomId: data.roomId, externalVenueId: null }),
        ...(data.externalVenueId !== undefined && { externalVenueId: data.externalVenueId, roomId: null }),
        ...(data.status && { status: data.status }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason })
      },
      include: {
        user: true,
        room: true,
        externalVenue: true
      }
    })

    updatedBookings.push(updatedBooking)

    // Queue notification if status changed
    if (statusChanged && updatedBooking.user) {
      const bookingDateTime = formatBookingDateTime(updatedBooking)
      const statusMessages: Record<string, string> = {
        CONFIRMED: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been confirmed${updatedBooking.room ? ` in ${updatedBooking.room.name}` : updatedBooking.externalVenue ? ` at ${updatedBooking.externalVenue.building} - ${updatedBooking.externalVenue.roomName}` : ''}.`,
        AWAITING_EXTERNAL: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been assigned to an external venue and is awaiting confirmation.`,
        REJECTED: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been rejected${updatedBooking.rejectionReason ? `: ${updatedBooking.rejectionReason}` : '.'}`,
        CANCELLED: `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) has been cancelled.`
      }

      const message = statusMessages[updatedBooking.status] || `Your booking "${updatedBooking.eventTitle}" (${bookingDateTime}) status has been updated to ${updatedBooking.status}.`

      notifications.push({
        user: updatedBooking.user,
        booking: updatedBooking,
        message
      })
    }
  }

  // Send all notifications grouped by user (one email per user with all their updates)
  await notifyBulkBookingUpdates(notifications).catch((err) => {
    console.error('Failed to send bulk booking notifications:', err)
  })

  return {
    updated: updatedBookings.length,
    bookings: updatedBookings
  }
})
