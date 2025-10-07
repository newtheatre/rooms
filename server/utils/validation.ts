/**
 * Validation Utilities
 *
 * Provides validation schemas and helper functions for API request validation
 * using Zod.
 *
 * @module server/utils/validation
 */

import { z } from 'zod'

/**
 * Email validation schema
 */
export const emailSchema = z.email('Invalid email address')

/**
 * Password validation schema
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

/**
 * User registration schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required').max(255),
  password: passwordSchema
})

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
})

/**
 * Notification channel schema
 */
export const notificationChannelSchema = z.enum(['EMAIL', 'PUSH'])

/**
 * Notification preference schema
 */
export const notificationPreferenceSchema = z.enum(['BOOKING_UPDATES'])

/**
 * User preferences update schema
 */
export const updatePreferencesSchema = z.object({
  notificationChannels: z.array(notificationChannelSchema).optional(),
  notificationPreferences: z.array(notificationPreferenceSchema).optional()
})

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  email: emailSchema.optional()
})

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema
})

/**
 * Reset password schema
 */
export const resetPasswordSchema = z.object({
  password: passwordSchema
})

/**
 * Role schema
 */
export const roleSchema = z.enum(['ADMIN', 'STANDARD'])

export const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: emailSchema,
  role: roleSchema,
  password: z.string().min(8).optional()
})

/**
 * Update user schema (admin)
 */
export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  email: emailSchema.optional(),
  role: roleSchema.optional()
})

/**
 * Booking status schema
 */
export const bookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'AWAITING_EXTERNAL',
  'REJECTED',
  'CANCELLED'
])

/**
 * Create booking schema
 */
export const createBookingSchema = z.object({
  eventTitle: z.string().min(1, 'Event title is required').max(255),
  numberOfAttendees: z.number().int().positive().optional(),
  startTime: z.string().datetime('Invalid start time'),
  endTime: z.string().datetime('Invalid end time'),
  notes: z.string().max(1000).optional()
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

/**
 * Create room schema
 */
export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(255),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true)
})

/**
 * Create external venue schema
 */
export const createVenueSchema = z.object({
  campus: z.string().max(255).optional(),
  building: z.string().min(1, 'Building is required').max(255),
  roomName: z.string().min(1, 'Room name is required').max(255),
  contactDetails: z.string().max(500).optional()
})

/**
 * Push subscription schema
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url('Invalid endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth key is required')
  })
})

/**
 * Push unsubscribe schema
 */
export const pushUnsubscribeSchema = z.object({
  endpoint: z.url('Invalid endpoint URL')
})
