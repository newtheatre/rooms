import type { CalendarDate } from '@internationalized/date'

/**
 * Combines a CalendarDate and time string (HH:MM) into an ISO datetime string
 * @param date CalendarDate from @internationalized/date
 * @param time Time string in HH:MM format
 * @returns ISO 8601 datetime string
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
