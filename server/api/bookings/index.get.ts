/**
 * List Bookings Endpoint
 *
 * Retrieves bookings based on user role.
 * - Admin: All bookings
 * - Standard user: Only their own bookings
 *
 * Query Parameters:
 * - status?: BookingStatus (filter by status)
 * - startDate?: ISO 8601 date (filter bookings starting after this date)
 * - endDate?: ISO 8601 date (filter bookings ending before this date)
 * - roomId?: number (filter by room)
 *
 * Process:
 * 1. Get authenticated user from session
 * 2. Build query filters based on role and query params
 * 3. Fetch bookings from database with relations (user, room, externalVenue)
 * 4. Return bookings array
 *
 * Response:
 * - 200: Array of booking objects with relations
 * - 401: Not authenticated
 *
 * Uses nuxt-auth-utils:
 * - requireUserSession(event)
 *
 * @method GET
 * @route /api/bookings
 * @authenticated
 */
import prisma from '~~/server/database'
import type { Prisma } from '@prisma/client'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'List bookings',
    description: 'Retrieves bookings based on user role (admins see all, users see their own)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'status',
        schema: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'] },
        description: 'Filter by booking status'
      },
      {
        in: 'query',
        name: 'startDate',
        schema: { type: 'string', format: 'date-time' },
        description: 'Filter bookings starting after this date'
      },
      {
        in: 'query',
        name: 'endDate',
        schema: { type: 'string', format: 'date-time' },
        description: 'Filter bookings ending before this date'
      },
      {
        in: 'query',
        name: 'roomId',
        schema: { type: 'integer' },
        description: 'Filter by room ID'
      }
    ],
    responses: {
      200: {
        description: 'List of bookings',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  userId: { type: 'string', nullable: true },
                  roomId: { type: 'integer', nullable: true },
                  externalVenueId: { type: 'integer', nullable: true },
                  eventTitle: { type: 'string' },
                  numberOfAttendees: { type: 'integer', nullable: true },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'] },
                  notes: { type: 'string', nullable: true },
                  rejectionReason: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  const db = prisma

  // Parse query parameters
  const query = getQuery(event)
  const statusFilter = query.status as string | undefined
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const roomId = query.roomId as string | undefined

  // Build where clause
  const where: Prisma.BookingWhereInput = {}

  // Filter by user if not admin
  if (user.role !== 'ADMIN') {
    where.userId = user.id
  }

  // Apply status filter
  if (statusFilter && ['PENDING', 'CONFIRMED', 'AWAITING_EXTERNAL', 'REJECTED', 'CANCELLED'].includes(statusFilter)) {
    where.status = statusFilter as 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
  }

  // Apply date filters
  if (startDate) {
    where.startTime = { gte: new Date(startDate) }
  }
  if (endDate) {
    where.endTime = { lte: new Date(endDate) }
  }

  // Apply room filter
  if (roomId) {
    const roomIdNum = Number.parseInt(roomId)
    if (!Number.isNaN(roomIdNum)) {
      where.roomId = roomIdNum
    }
  }

  // Fetch bookings with relations
  const bookings = await db.booking.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      room: true,
      externalVenue: true
    },
    orderBy: { startTime: 'desc' }
  })

  return bookings
})
