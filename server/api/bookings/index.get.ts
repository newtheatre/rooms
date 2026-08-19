/**
 * List bookings. Admins see all; a standard user sees only their own, scoped
 * server-side rather than by a query parameter.
 */
import { schema } from '@nuxthub/db'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { BOOKING_STATUSES, type BookingStatus } from '~~/server/db/schema/booking'

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

  // Parse query parameters
  const query = await getValidatedQuery(event, bookingQuerySchema.parse)
  const statusFilter = query.status
  const startDate = query.startDate
  const endDate = query.endDate
  const roomId = query.roomId

  const isValidStatus = statusFilter
    && (BOOKING_STATUSES as readonly string[]).includes(statusFilter)

  const roomIdNum = roomId ? Number.parseInt(roomId) : Number.NaN

  const where = and(
    // Non-admins only ever see their own bookings.
    can(user, 'booking.read.any') ? undefined : eq(schema.bookings.userId, user.id),
    isValidStatus ? eq(schema.bookings.status, statusFilter as BookingStatus) : undefined,
    startDate ? gte(schema.bookings.startTime, new Date(startDate)) : undefined,
    endDate ? lte(schema.bookings.endTime, new Date(endDate)) : undefined,
    Number.isNaN(roomIdNum) ? undefined : eq(schema.bookings.roomId, roomIdNum)
  )

  return await findBookings(where, [desc(schema.bookings.startTime)])
})
