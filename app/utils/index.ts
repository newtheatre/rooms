import type { CalendarDate } from '@internationalized/date'

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
