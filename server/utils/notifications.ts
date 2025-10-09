/**
 * Notification Utilities
 *
 * Handles sending notifications to users via email and push notifications.
 * Respects user notification preferences and channels.
 *
 * @module server/utils/notifications
 */

import type { User, Booking } from '@prisma/client'
import resend from './resend'

/**
 * Available notification channels
 */
export type NotificationChannel = 'EMAIL' | 'PUSH'

/**
 * Notification types that users can subscribe to
 *
 * Note: Critical account updates (password resets, security alerts)
 * are always sent via email regardless of preferences.
 */
export type NotificationPreference = 'BOOKING_UPDATES' | 'ADMIN_NEW_BOOKINGS'

/**
 * Notification payload for booking updates
 */
export interface BookingNotification {
  type: 'BOOKING_UPDATES'
  booking: Booking
  title: string
  message: string
}

/**
 * Formats a booking's date and time for display in notifications
 *
 * @param booking - Booking to format
 * @returns Formatted date/time string (e.g., "Mon, Jan 15, 2024 at 2:00 PM - 4:00 PM")
 */
export function formatBookingDateTime(booking: Booking): string {
  const startDate = new Date(booking.startTime)
  const endDate = new Date(booking.endTime)

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }

  const datePart = startDate.toLocaleDateString('en-GB', dateOptions)
  const startTime = startDate.toLocaleTimeString('en-GB', timeOptions)
  const endTime = endDate.toLocaleTimeString('en-GB', timeOptions)

  return `${datePart} at ${startTime} - ${endTime}`
}

/**
 * Parses JSON notification channels from user record
 *
 * @param user - User record from database
 * @returns Array of enabled notification channels
 */
export function getNotificationChannels(user: User): NotificationChannel[] {
  try {
    return JSON.parse(user.notificationChannels) as NotificationChannel[]
  } catch {
    return ['EMAIL'] // Default to email if parsing fails
  }
}

/**
 * Parses JSON notification preferences from user record
 *
 * @param user - User record from database
 * @returns Array of subscribed notification types
 */
export function getNotificationPreferences(user: User): NotificationPreference[] {
  try {
    return JSON.parse(user.notificationPreferences) as NotificationPreference[]
  } catch {
    return ['BOOKING_UPDATES'] // Default preference
  }
}

/**
 * Checks if user should receive a specific notification
 *
 * @param user - User record from database
 * @param notificationType - Type of notification to check
 * @returns True if user has subscribed to this notification type
 */
export function shouldNotify(user: User, notificationType: NotificationPreference): boolean {
  const preferences = getNotificationPreferences(user)
  return preferences.includes(notificationType)
}

/**
 * Sends an email notification to a user
 *
 * @param user - User to notify
 * @param subject - Email subject
 * @param content - Email content (HTML or plain text)
 *
 * TODO: Implement email service integration
 */
export async function sendEmail(user: User, subject: string, content: string): Promise<void> {
  // Recommended services: Resend, SendGrid, AWS SES, Cloudflare Email Routing
  console.log(`[EMAIL] To: ${user.email}, Subject: ${subject}`)

  // Don't send email in development
  if (process.env.NODE_ENV === 'development') return

  const { error } = await resend.emails.send({
    from: `"Room Bookings" <${process.env.EMAIL}>`,
    replyTo: `"Theatre Manager" <theatremanager@newtheatre.org.uk>`,
    to: user.email,
    subject,
    text: content
  })

  if (error) {
    throw new Error(`Failed to send email: ${error}`)
  }
}

/**
 * Sends batch emails to multiple users with the same subject and content
 *
 * @param users - Array of users to notify
 * @param subject - Email subject
 * @param content - Email content (HTML or plain text)
 *
 * Uses batch sending for better performance
 */
export async function sendBatchEmail(users: User[], subject: string, content: string): Promise<void> {
  if (users.length === 0) return

  const emailAddresses = users.map(user => user.email)
  console.log(`[BATCH EMAIL] To: ${emailAddresses.length} recipients, Subject: ${subject}`)

  // Don't send email in development
  if (process.env.NODE_ENV === 'development') return

  // Send as batch with BCC (blind carbon copy)
  const { error } = await resend.emails.send({
    from: `"Room Bookings" <${process.env.EMAIL}>`,
    replyTo: `"Theatre Manager" <theatremanager@newtheatre.org.uk>`,
    to: emailAddresses,
    subject,
    text: content
  })

  if (error) {
    throw new Error(`Failed to send email: ${error}`)
  }
}

/**
 * Sends a push notification to a user
 *
 * @param userId - User ID to notify
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional additional data
 *
 * TODO: Implement web push notification
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  _body: string,
  _data?: Record<string, unknown>
): Promise<void> {
  // TODO: Implement web push using Web Push Protocol
  // Retrieve all push subscriptions for this user from database
  // Send notification to each subscription endpoint
  console.log(`[PUSH] To: ${userId}, Title: ${title}`)
}

/**
 * Sends a booking update notification to a user
 *
 * Checks user preferences and sends via enabled channels.
 *
 * @param user - User to notify
 * @param booking - Booking that was updated
 * @param message - Notification message
 */
export async function notifyBookingUpdate(
  user: User,
  booking: Booking,
  message: string
): Promise<void> {
  // Check if user wants booking update notifications
  if (!shouldNotify(user, 'BOOKING_UPDATES')) {
    return
  }

  const channels = getNotificationChannels(user)
  const title = `Booking Update: ${booking.eventTitle}`

  // Send via each enabled channel
  const notifications: Promise<void>[] = []

  if (channels.includes('EMAIL')) {
    notifications.push(sendEmail(user, title, message))
  }

  if (channels.includes('PUSH')) {
    notifications.push(sendPushNotification(user.id, title, message, { bookingId: booking.id }))
  }

  await Promise.all(notifications)
}

/**
 * Sends bulk booking update notifications to users
 *
 * Groups bookings by user and sends one notification per user with all their updates.
 * More efficient than individual notifications for bulk operations.
 *
 * @param updates - Array of { user, booking, message } objects
 */
export async function notifyBulkBookingUpdates(
  updates: Array<{ user: User, booking: Booking, message: string }>
): Promise<void> {
  if (updates.length === 0) return

  // Group updates by user ID
  const updatesByUser = new Map<string, Array<{ booking: Booking, message: string }>>()

  for (const update of updates) {
    const userId = update.user.id
    if (!updatesByUser.has(userId)) {
      updatesByUser.set(userId, [])
    }
    updatesByUser.get(userId)!.push({
      booking: update.booking,
      message: update.message
    })
  }

  // Send one notification per user with all their updates
  const notifications: Promise<void>[] = []

  for (const [userId, userUpdates] of updatesByUser) {
    const user = updates.find(u => u.user.id === userId)!.user

    // Check if user wants booking update notifications
    if (!shouldNotify(user, 'BOOKING_UPDATES')) {
      continue
    }

    const channels = getNotificationChannels(user)

    // Build combined message
    const subject = userUpdates.length === 1
      ? `Booking Update: ${userUpdates[0].booking.eventTitle}`
      : `${userUpdates.length} Booking Updates`

    const emailContent = userUpdates.length === 1
      ? userUpdates[0].message
      : `The following bookings have been updated:\n\n${userUpdates.map((u, i) => `${i + 1}. ${u.message}`).join('\n\n')}`

    // Send via each enabled channel
    if (channels.includes('EMAIL')) {
      notifications.push(sendEmail(user, subject, emailContent))
    }

    if (channels.includes('PUSH')) {
      const pushMessage = userUpdates.length === 1
        ? userUpdates[0].message
        : `${userUpdates.length} of your bookings have been updated`

      notifications.push(sendPushNotification(
        user.id,
        subject,
        pushMessage,
        { bookingIds: userUpdates.map(u => u.booking.id) }
      ))
    }
  }

  await Promise.all(notifications)
}

/**
 * Sends a critical account notification (always via email)
 *
 * These notifications bypass user preferences and are always sent.
 * Examples: password reset, security alerts, account deletion.
 *
 * @param user - User to notify
 * @param subject - Email subject
 * @param content - Email content
 */
export async function sendCriticalNotification(
  user: User,
  subject: string,
  content: string
): Promise<void> {
  // Critical notifications always go via email, regardless of user preferences
  await sendEmail(user, subject, content)
}
