/**
 * Which rooms are free for a time range. `excludeBookingId` omits a booking's
 * own rows so editing it does not conflict with itself.
 */

import { getAvailableRooms } from '~~/server/utils/availability'

defineRouteMeta({
  openAPI: {
    tags: ['Rooms'],
    summary: 'Check room availability',
    description: 'Get available and unavailable rooms for a time range',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'startTime',
        required: true,
        schema: { type: 'string', format: 'date-time' },
        description: 'Start time of the booking'
      },
      {
        in: 'query',
        name: 'endTime',
        required: true,
        schema: { type: 'string', format: 'date-time' },
        description: 'End time of the booking'
      },
      {
        in: 'query',
        name: 'excludeBookingId',
        schema: { type: 'integer' },
        description: 'Booking ID to exclude from conflict checking (for editing)'
      },
      {
        in: 'query',
        name: 'includeInactive',
        schema: { type: 'boolean' },
        description: 'Include inactive rooms (admin only)'
      },
      {
        in: 'query',
        name: 'includeUnavailable',
        schema: { type: 'boolean' },
        description: 'Include unavailable rooms with conflict details'
      }
    ],
    responses: {
      200: {
        description: 'Room availability results',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                available: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      capacity: { type: 'integer', nullable: true },
                      isActive: { type: 'boolean' }
                    }
                  }
                },
                unavailable: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
                      description: { type: 'string', nullable: true },
                      capacity: { type: 'integer', nullable: true },
                      isActive: { type: 'boolean' },
                      conflicts: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            eventTitle: { type: 'string' },
                            startTime: { type: 'string', format: 'date-time' },
                            endTime: { type: 'string', format: 'date-time' },
                            status: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                },
                totalAvailable: { type: 'integer' },
                totalUnavailable: { type: 'integer' }
              }
            }
          }
        }
      },
      400: { description: 'Invalid parameters' },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event)

  const query = await getValidatedQuery(event, availableRoomsQuerySchema.parse)

  const startTime = new Date(query.startTime)
  const endTime = new Date(query.endTime)

  const excludeBookingId = query.excludeBookingId
  const includeInactive = can(user, 'room.read.inactive') && query.includeInactive
  const includeUnavailable = query.includeUnavailable

  // Get available rooms
  const { available, unavailable } = await getAvailableRooms(
    startTime,
    endTime,
    {
      excludeBookingId,
      includeInactive
    }
  )

  // Format conflicts to hide sensitive user data for non-admins
  interface ConflictWithUser {
    id: number
    eventTitle: string
    startTime: Date
    endTime: Date
    status: string
    user?: {
      id: string
      name: string
      email: string
    }
  }

  const formatConflicts = (conflicts: typeof unavailable[0]['conflicts']) => {
    return conflicts.map((conflict) => {
      const formatted: Record<string, unknown> = {
        id: conflict.id,
        eventTitle: can(user, 'booking.read.any') ? conflict.eventTitle : 'Booked',
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        status: conflict.status
      }

      const conflictWithUser = conflict as unknown as ConflictWithUser
      if (can(user, 'booking.read.any') && conflictWithUser.user) {
        formatted.user = conflictWithUser.user
      }

      return formatted
    })
  }

  const response = {
    available,
    unavailable: includeUnavailable
      ? unavailable.map(room => ({
          ...room,
          conflicts: formatConflicts(room.conflicts)
        }))
      : [],
    totalAvailable: available.length,
    totalUnavailable: unavailable.length
  }

  return response
})
