/** Zod schemas for request bodies and query strings. */

import { z } from 'zod'

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
)

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
)

/**
 * Update booking schema (admin)
 */
export const updateBookingSchema = z.object({
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
