/** Zod schemas for request bodies and query strings. */

import { z } from 'zod'

/**
 * An all-optional body that parses to `{}` reaches Drizzle's `.set()`, which
 * throws a bare Error and surfaces as a 500 rather than a 400.
 */
function atLeastOneField<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(value => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update'
  })
}

/** Query strings arrive as strings; these coerce and reject rather than cast. */
const booleanFlag = z.enum(['true', 'false']).optional().transform(v => v === 'true')

/**
 * A bare `.parse` inside a handler throws a ZodError, which Nitro reports as a
 * 500. Route bodies that cannot use `readValidatedBody` go through this.
 */
export function parseOr400<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: { issues: result.error.issues }
    })
  }

  return result.data
}

// Credential schemas (register, login, password, profile) were deleted at the
// stage-door cutover: this app must never handle credentials.

export const notificationChannelSchema = z.enum(['EMAIL', 'PUSH'])

export const notificationPreferenceSchema = z.enum(['BOOKING_UPDATES', 'ADMIN_NEW_BOOKINGS'])

export const updatePreferencesSchema = z.object({
  notificationChannels: z.array(notificationChannelSchema).optional(),
  notificationPreferences: z.array(notificationPreferenceSchema).optional()
})

export const bookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'AWAITING_EXTERNAL',
  'REJECTED',
  'CANCELLED'
])

export const recurrenceFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'CUSTOM'])

export const dayOfWeekSchema = z.enum(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])

export const recurringPatternSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().min(1).max(365).optional().default(1),
  daysOfWeek: z.array(dayOfWeekSchema).min(1).optional(),
  maxOccurrences: z.number().int().min(1).max(52), // Soft limit of 12 in UI
  endDate: z.iso.datetime().optional()
}).refine(
  (data) => {
    // Weekly recurrence requires daysOfWeek
    if (data.frequency === 'WEEKLY' && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
      return false
    }
    return true
  },
  {
    message: 'Weekly recurrence requires at least one day of week',
    path: ['daysOfWeek']
  }
)

/** An endDate at or before the booking start expands to nothing at all. */
function endDateAfterStart(data: { startTime: string, recurringPattern?: { endDate?: string } }) {
  const endDate = data.recurringPattern?.endDate
  return !endDate || new Date(endDate) > new Date(data.startTime)
}

const endDateMessage = {
  message: 'Recurrence end date must be after the booking starts',
  path: ['recurringPattern', 'endDate']
}

export const createBookingSchema = z.object({
  eventTitle: z.string().min(1, 'Event title is required').max(255),
  numberOfAttendees: z.number().int().positive().optional(),
  startTime: z.iso.datetime('Invalid start time'),
  endTime: z.iso.datetime('Invalid end time'),
  notes: z.string().max(1000).optional(),
  recurringPattern: recurringPatternSchema.optional()
}).refine(
  (data) => {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    return end > start
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
).refine(endDateAfterStart, endDateMessage)

/**
 * Admin create booking schema (allows setting userId, roomId, externalVenueId, status)
 */
export const adminCreateBookingSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  eventTitle: z.string().min(1, 'Event title is required').max(255),
  numberOfAttendees: z.number().int().positive().optional(),
  startTime: z.iso.datetime('Invalid start time'),
  endTime: z.iso.datetime('Invalid end time'),
  roomId: z.number().int().positive().optional(),
  externalVenueId: z.number().int().positive().optional(),
  status: bookingStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
  recurringPattern: recurringPatternSchema.optional()
}).refine(
  (data) => {
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    return end > start
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
).refine(
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
).refine(endDateAfterStart, endDateMessage)

/**
 * Update booking schema (admin)
 */
export const updateBookingSchema = z.object({
  roomId: z.number().int().positive().optional(),
  externalVenueId: z.number().int().positive().optional(),
  status: bookingStatusSchema.optional(),
  rejectionReason: z.string().max(500).optional(),
  // The admin override: double-book deliberately, which the UI asks about first.
  allowConflicts: z.boolean().optional()
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
).refine(
  (data) => {
    // Rejection reason required when status is REJECTED
    if (data.status === 'REJECTED' && !data.rejectionReason) {
      return false
    }
    return true
  },
  {
    message: 'Rejection reason is required when rejecting a booking',
    path: ['rejectionReason']
  }
)

/**
 * Written out rather than derived: Zod 4 refuses `.partial()` on a schema
 * carrying a refinement, and createBookingSchema has one.
 */
export const ownerUpdateBookingSchema = z.object({
  eventTitle: z.string().min(1, 'Event title is required').max(255).optional(),
  numberOfAttendees: z.number().int().positive().optional(),
  startTime: z.iso.datetime('Invalid start time').optional(),
  endTime: z.iso.datetime('Invalid end time').optional(),
  notes: z.string().max(1000).optional(),
  // Cancelling is the only status an owner may set.
  status: z.literal('CANCELLED').optional()
}).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return new Date(data.endTime) > new Date(data.startTime)
    }
    return true
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
)

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(255),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true)
})

export const createVenueSchema = z.object({
  campus: z.string().max(255).optional(),
  building: z.string().min(1, 'Building is required').max(255),
  roomName: z.string().min(1, 'Room name is required').max(255),
  contactDetails: z.string().max(500).optional()
})

/**
 * Written out rather than derived: `.partial()` keeps `isActive`'s default, so
 * a body that omits it would silently reactivate a deactivated room.
 */
export const updateRoomSchema = atLeastOneField(z.object({
  name: z.string().min(1, 'Room name is required').max(255).optional(),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
}))

export const updateVenueSchema = atLeastOneField(createVenueSchema.partial())

export const bookingQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  startDate: z.iso.datetime('Invalid start date').optional(),
  endDate: z.iso.datetime('Invalid end date').optional(),
  roomId: z.coerce.number().int().positive().optional()
})

export const roomListQuerySchema = z.object({
  includeInactive: booleanFlag
})

export const userListQuerySchema = z.object({
  search: z.string().max(255).optional()
})

export const venueListQuerySchema = z.object({
  campus: z.string().max(255).optional(),
  building: z.string().max(255).optional()
})

export const availableRoomsQuerySchema = z.object({
  startTime: z.iso.datetime('Invalid start time'),
  endTime: z.iso.datetime('Invalid end time'),
  excludeBookingId: z.coerce.number().int().positive().optional(),
  includeInactive: booleanFlag,
  includeUnavailable: booleanFlag
}).refine(
  data => new Date(data.endTime) > new Date(data.startTime),
  { message: 'End time must be after start time', path: ['endTime'] }
)

export const roomDeleteQuerySchema = z.object({
  permanent: booleanFlag
})

export const pushSubscriptionSchema = z.object({
  endpoint: z.url('Invalid endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth key is required')
  })
})

export const pushUnsubscribeSchema = z.object({
  endpoint: z.url('Invalid endpoint URL')
})
