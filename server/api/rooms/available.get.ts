/**
 * Check Room Availability Endpoint
 *
 * Retrieves available and unavailable rooms for a given time range.
 * Useful for showing real-time availability when creating/editing bookings.
 *
 * Query Parameters:
 * - startTime: ISO 8601 datetime (required)
 * - endTime: ISO 8601 datetime (required)
 * - excludeBookingId: number (optional - for editing existing bookings)
 * - includeInactive: boolean (default: false, admin only)
 * - includeUnavailable: boolean (default: false - whether to include unavailable rooms in response)
 *
 * Process:
 * 1. Require authentication
 * 2. Validate time parameters
 * 3. Check each room for conflicts
 * 4. Return categorized results
 *
 * Response:
 * - 200: Object with available and unavailable rooms
 * - 400: Invalid parameters
 * - 401: Not authenticated
 *
 * @method GET
 * @route /api/rooms/available
 * @authenticated
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

  const query = getQuery(event)

  // Validate required parameters
  if (!query.startTime || !query.endTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
      message: 'startTime and endTime are required'
    })
  }

  // Parse dates
  const startTime = new Date(query.startTime as string)
  const endTime = new Date(query.endTime as string)

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid date format',
      message: 'startTime and endTime must be valid ISO 8601 datetime strings'
    })
  }

  if (startTime >= endTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid time range',
      message: 'endTime must be after startTime'
    })
  }

  // Parse options
  const excludeBookingId = query.excludeBookingId ? Number(query.excludeBookingId) : undefined
  const includeInactive = user.role === 'ADMIN' && query.includeInactive === 'true'
  const includeUnavailable = query.includeUnavailable === 'true'

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
        eventTitle: user.role === 'ADMIN' ? conflict.eventTitle : 'Booked',
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        status: conflict.status
      }

      const conflictWithUser = conflict as unknown as ConflictWithUser
      if (user.role === 'ADMIN' && conflictWithUser.user) {
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
