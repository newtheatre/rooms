/**
 * Civil-date arithmetic in Europe/London. The Worker runs in UTC, so Date's
 * local mutators silently do the wrong thing across a clock change (ADR-0002).
 */

export const LONDON = 'Europe/London'

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export interface LondonParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/** How far London is ahead of UTC at this instant, in milliseconds. */
function offsetAt(instant: Date): number {
  const p = londonParts(instant)
  const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  // Seconds and below are not in the parts, so compare on whole minutes.
  return asIfUTC - Math.floor(instant.getTime() / 60_000) * 60_000
}

export function londonParts(instant: Date): LondonParts {
  const parts = partsFormat.formatToParts(instant)
  const value = (type: string) => Number(parts.find(p => p.type === type)!.value)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute')
  }
}

/**
 * The instant at which London's clock reads these parts. Resolved twice
 * because the offset that applies is the one at the answer, not at the guess.
 */
export function fromLondonParts(parts: LondonParts): Date {
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)

  let instant = new Date(wallClock - offsetAt(new Date(wallClock)))
  instant = new Date(wallClock - offsetAt(instant))

  return instant
}

/** Calendar days, done in UTC where every day is 24 hours long. */
export function addLondonDays(parts: LondonParts, days: number): LondonParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + days * 86_400_000)

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute
  }
}

/** 0 is Sunday, matching Date.getDay. */
export function londonWeekday(parts: LondonParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
}
