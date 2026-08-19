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

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})

/** How far London is ahead of UTC at this instant, in milliseconds. */
function londonOffset(instant: Date): number {
  const p = partsFormat.formatToParts(instant)
  const v = (type: string) => Number(p.find(part => part.type === type)!.value)
  const asIfUTC = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'))

  return asIfUTC - Math.floor(instant.getTime() / 60_000) * 60_000
}

/** The London wall-clock date and time of an instant, for populating a form. */
export function londonDateAndTime(value: Date | string | number): { date: string, time: string } {
  const p = partsFormat.formatToParts(new Date(value))
  const part = (type: string) => p.find(x => x.type === type)!.value

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`
  }
}

/**
 * Combine a CalendarDate and an HH:MM string into an ISO datetime, reading both
 * as London wall-clock rather than whatever zone the browser is set to.
 */
export function combineDateAndTime(date: CalendarDate, time: string): string {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  const wallClock = Date.UTC(date.year, date.month - 1, date.day, hour, minute)

  // Resolved twice: the offset that applies is the one at the answer.
  let instant = wallClock - londonOffset(new Date(wallClock))
  instant = wallClock - londonOffset(new Date(instant))

  return new Date(instant).toISOString()
}
