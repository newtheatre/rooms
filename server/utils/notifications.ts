/**
 * Sending notifications to users, subject to their channel and type preferences.
 *
 * PUSH is not implemented — see sendPushNotification.
 */

import type { User } from '~~/server/db/schema/user'
import type { Booking } from '~~/server/db/schema/booking'
import { getResend } from './resend'

export type NotificationChannel = 'EMAIL' | 'PUSH'

/** Preferences do not gate sendCriticalNotification, which always emails. */
export type NotificationPreference = 'BOOKING_UPDATES' | 'ADMIN_NEW_BOOKINGS'

export interface BookingNotification {
  type: 'BOOKING_UPDATES'
  booking: Booking
  title: string
  message: string
}

export const LONDON = 'Europe/London'

/** e.g. "Mon, 15 Jan 2024 at 2:00 pm - 4:00 pm". */
export function formatBookingDateTime(booking: Booking): string {
  const startDate = new Date(booking.startTime)
  const endDate = new Date(booking.endTime)

  // The Worker runs in UTC, so an unpinned zone is an hour out through BST.
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: LONDON,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }

  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: LONDON,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }

  const datePart = startDate.toLocaleDateString('en-GB', dateOptions)
  const startTime = startDate.toLocaleTimeString('en-GB', timeOptions)
  const endTime = endDate.toLocaleTimeString('en-GB', timeOptions)

  return `${datePart} at ${startTime} - ${endTime}`
}

/** Stored as a JSON string; unparseable values fall back to email only. */
export function getNotificationChannels(user: User): NotificationChannel[] {
  try {
    return JSON.parse(user.notificationChannels) as NotificationChannel[]
  } catch {
    return ['EMAIL']
  }
}

/** Stored as a JSON string; unparseable values fall back to booking updates. */
export function getNotificationPreferences(user: User): NotificationPreference[] {
  try {
    return JSON.parse(user.notificationPreferences) as NotificationPreference[]
  } catch {
    return ['BOOKING_UPDATES']
  }
}

export function shouldNotify(user: User, notificationType: NotificationPreference): boolean {
  const preferences = getNotificationPreferences(user)
  return preferences.includes(notificationType)
}

/** Sends one email via Resend. No-op in development. */
export async function sendEmail(user: User, subject: string, content: string): Promise<void> {
  console.log(`[EMAIL] To: ${user.email}, Subject: ${subject}`)

  if (process.env.NODE_ENV === 'development') return

  const resend = getResend()
  if (!resend) return

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
 * Recipients go in `bcc` so they are not disclosed to each other; Resend still
 * requires a `to`, which is the sending address.
 */
export async function sendBatchEmail(users: User[], subject: string, content: string): Promise<void> {
  if (users.length === 0) return

  const emailAddresses = users.map(user => user.email)
  console.log(`[BATCH EMAIL] To: ${emailAddresses.length} recipients, Subject: ${subject}`)

  if (process.env.NODE_ENV === 'development') return

  const resend = getResend()
  if (!resend) return

  const { error } = await resend.emails.send({
    from: `"Room Bookings" <${process.env.EMAIL}>`,
    replyTo: `"Theatre Manager" <theatremanager@newtheatre.org.uk>`,
    to: `"Room Bookings" <${process.env.EMAIL}>`,
    bcc: emailAddresses,
    subject,
    text: content
  })

  if (error) {
    throw new Error(`Failed to send email: ${error}`)
  }
}

/**
 * NOT IMPLEMENTED — logs and returns, so the PUSH channel delivers nothing.
 * TODO: send via Web Push Protocol to push_subscriptions.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  _body: string,
  _data?: Record<string, unknown>
): Promise<void> {
  console.log(`[PUSH] To: ${userId}, Title: ${title}`)
}

/** Sends via whichever channels the user has enabled, if they want the type at all. */
export async function notifyBookingUpdate(
  user: User,
  booking: Booking,
  message: string
): Promise<void> {
  if (!shouldNotify(user, 'BOOKING_UPDATES')) {
    return
  }

  const channels = getNotificationChannels(user)
  const title = `Booking Update: ${booking.eventTitle}`

  const notifications: Promise<void>[] = []

  if (channels.includes('EMAIL')) {
    notifications.push(sendEmail(user, title, message))
  }

  if (channels.includes('PUSH')) {
    notifications.push(sendPushNotification(user.id, title, message, { bookingId: booking.id }))
  }

  await Promise.all(notifications)
}

/** One notification per user covering all their updates, not one per booking. */
export async function notifyBulkBookingUpdates(
  updates: Array<{ user: User, booking: Booking, message: string }>
): Promise<void> {
  if (updates.length === 0) return

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

  const notifications: Promise<void>[] = []

  for (const [userId, userUpdates] of updatesByUser) {
    const user = updates.find(u => u.user.id === userId)!.user

    if (!shouldNotify(user, 'BOOKING_UPDATES')) {
      continue
    }

    const channels = getNotificationChannels(user)

    // The map is only ever populated with a non-empty array.
    const only = userUpdates.length === 1 ? userUpdates[0]! : null

    const subject = only
      ? `Booking Update: ${only.booking.eventTitle}`
      : `${userUpdates.length} Booking Updates`

    const emailContent = only
      ? only.message
      : `The following bookings have been updated:\n\n${userUpdates.map((u, i) => `${i + 1}. ${u.message}`).join('\n\n')}`

    if (channels.includes('EMAIL')) {
      notifications.push(sendEmail(user, subject, emailContent))
    }

    if (channels.includes('PUSH')) {
      const pushMessage = only
        ? only.message
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
 * Account-security mail (password reset, account deletion). Always emails,
 * regardless of preferences.
 */
export async function sendCriticalNotification(
  user: User,
  subject: string,
  content: string
): Promise<void> {
  await sendEmail(user, subject, content)
}
