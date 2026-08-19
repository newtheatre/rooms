import type { CalendarDate } from '@internationalized/date'

export const LONDON = 'Europe/London'

// Built once: constructing a formatter per render is the expensive part.
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON, dateStyle: 'medium', timeStyle: 'short'
})
const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit' })

// A CalendarDate carries no instant, so it is read back in the zone it was built in.
const calendarDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium' })

/** A booking instant, always in London wall-clock time. */
export function formatDateTime(value: Date | string | number): string {
  return dateTimeFormat.format(new Date(value))
}

export function formatDate(value: Date | string | number): string {
  return dateFormat.format(new Date(value))
}

export function formatTime(value: Date | string | number): string {
  return timeFormat.format(new Date(value))
}

/** For a date-picker label, where the value is a calendar date and not an instant. */
export function formatCalendarDate(date: CalendarDate): string {
  return calendarDateFormat.format(date.toDate('UTC'))
}

/**
 * Combine a CalendarDate and an HH:MM string into an ISO datetime.
 */
export function combineDateAndTime(date: CalendarDate, time: string): string {
  const [hour, minute] = time.split(':').map(Number)

  const dateTime = new Date(
    date.year,
    date.month - 1, // JavaScript months are 0-indexed
    date.day,
    hour,
    minute
  )

  return dateTime.toISOString()
}
