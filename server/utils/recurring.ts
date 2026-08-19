/**
 * Expands a recurrence pattern into individual booking rows. There is no
 * series entity — occurrences are handled one at a time.
 */

import { db, schema } from '@nuxthub/db'

import type { RecurringPattern, Booking } from '~~/server/db/schema/booking'
import { checkRoomAvailability, checkVenueAvailability } from './availability'
import type { LondonParts } from './london'
import { addLondonDays, fromLondonParts, londonParts, londonWeekday } from './london'

export interface RecurringPatternInput {
  frequency: 'DAILY' | 'WEEKLY' | 'CUSTOM'
  interval?: number // Default 1
  daysOfWeek?: string[] // For WEEKLY: ['MON', 'TUE', 'WED', ...]
  maxOccurrences: number // 1-52 (soft limit of 12 in UI)
  endDate?: Date
}

export interface RecurringOccurrence {
  occurrenceNumber: number
  startTime: Date
  endTime: Date
}

const MAX_OCCURRENCES = 52
const DAYS_OF_WEEK_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6
}

/**
 * Validate a recurring pattern
 */
export function validateRecurringPattern(pattern: RecurringPatternInput): void {
  if (!pattern.frequency || !['DAILY', 'WEEKLY', 'CUSTOM'].includes(pattern.frequency)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid frequency',
      message: 'Frequency must be DAILY, WEEKLY, or CUSTOM'
    })
  }

  if (pattern.maxOccurrences < 1 || pattern.maxOccurrences > MAX_OCCURRENCES) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid max occurrences',
      message: `Max occurrences must be between 1 and ${MAX_OCCURRENCES}`
    })
  }

  if (pattern.interval && (pattern.interval < 1 || pattern.interval > 365)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid interval',
      message: 'Interval must be between 1 and 365'
    })
  }

  if (pattern.frequency === 'WEEKLY') {
    if (!pattern.daysOfWeek || pattern.daysOfWeek.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing days of week',
        message: 'Weekly recurrence requires at least one day of week'
      })
    }

    const invalidDays = pattern.daysOfWeek.filter(day => !(day in DAYS_OF_WEEK_MAP))
    if (invalidDays.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid days of week',
        message: `Invalid days: ${invalidDays.join(', ')}. Use SUN, MON, TUE, WED, THU, FRI, SAT`
      })
    }
  }
}

/**
 * Generate recurring occurrences based on a pattern
 */
export function generateRecurringOccurrences(
  pattern: RecurringPatternInput,
  baseStartTime: Date,
  baseEndTime: Date
): RecurringOccurrence[] {
  validateRecurringPattern(pattern)

  const occurrences: RecurringOccurrence[] = []
  const interval = pattern.interval || 1
  const duration = baseEndTime.getTime() - baseStartTime.getTime()

  // Held as London wall-clock parts, so 19:00 stays 19:00 across a clock change.
  const base = londonParts(baseStartTime)
  let cursor = base
  let occurrenceNumber = 1

  const push = (parts: LondonParts): boolean => {
    const startTime = fromLondonParts(parts)
    if (startTime < baseStartTime) return false
    if (pattern.endDate && startTime > pattern.endDate) return false

    occurrences.push({
      occurrenceNumber,
      startTime,
      endTime: new Date(startTime.getTime() + duration)
    })
    occurrenceNumber++
    return true
  }

  // Generate occurrences
  let steps = 0
  while (occurrenceNumber <= pattern.maxOccurrences) {
    if (++steps > MAX_OCCURRENCES * 10) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pattern generation error',
        message: 'This pattern does not produce the requested number of bookings.'
      })
    }

    if (pattern.endDate && fromLondonParts(cursor) > pattern.endDate) {
      break
    }

    if (pattern.frequency === 'WEEKLY') {
      const selectedDays = pattern.daysOfWeek!.map(day => DAYS_OF_WEEK_MAP[day])

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        if (occurrenceNumber > pattern.maxOccurrences) break

        const day = addLondonDays(cursor, dayOffset)
        if (selectedDays.includes(londonWeekday(day))) {
          push({ ...day, hour: base.hour, minute: base.minute })
        }
      }

      cursor = addLondonDays(cursor, 7 * interval)
    } else {
      // DAILY and CUSTOM differ only in the size of the step.
      push(cursor)
      cursor = addLondonDays(cursor, interval)
    }
  }

  return occurrences.slice(0, pattern.maxOccurrences)
}

/**
 * Check availability for all occurrences in a recurring pattern
 */
export async function checkRecurringAvailability(
  pattern: RecurringPatternInput,
  baseStartTime: Date,
  baseEndTime: Date,
  roomId?: number,
  externalVenueId?: number,
  excludeBookingId?: number
): Promise<{
  availableOccurrences: RecurringOccurrence[]
  conflictingOccurrences: Array<RecurringOccurrence & { conflicts: Booking[] }>
}> {
  const occurrences = generateRecurringOccurrences(pattern, baseStartTime, baseEndTime)

  const availableOccurrences: RecurringOccurrence[] = []
  const conflictingOccurrences: Array<RecurringOccurrence & { conflicts: Booking[] }> = []

  for (const occurrence of occurrences) {
    let hasConflict = false
    let conflicts: Booking[] = []

    if (roomId) {
      const result = await checkRoomAvailability(
        roomId,
        occurrence.startTime,
        occurrence.endTime,
        excludeBookingId
      )
      hasConflict = !result.isAvailable
      conflicts = result.conflicts
    } else if (externalVenueId) {
      const result = await checkVenueAvailability(
        externalVenueId,
        occurrence.startTime,
        occurrence.endTime,
        excludeBookingId
      )
      hasConflict = !result.isAvailable
      conflicts = result.conflicts
    }

    if (hasConflict) {
      conflictingOccurrences.push({ ...occurrence, conflicts })
    } else {
      availableOccurrences.push(occurrence)
    }
  }

  return {
    availableOccurrences,
    conflictingOccurrences
  }
}

/**
 * Create all bookings for a recurring pattern
 */
export async function createRecurringBookings(
  parentBookingData: {
    userId: string | null | undefined
    eventTitle: string
    numberOfAttendees?: number
    roomId?: number
    externalVenueId?: number
    status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
    notes?: string
  },
  pattern: RecurringPatternInput,
  baseStartTime: Date,
  baseEndTime: Date,
  allowConflicts = false
): Promise<{
  parentBooking: Booking
  childBookings: Booking[]
  pattern: RecurringPattern
}> {
  const occurrences = generateRecurringOccurrences(pattern, baseStartTime, baseEndTime)

  const firstOccurrence = occurrences[0]
  if (!firstOccurrence) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pattern produces no occurrences',
      message: 'This recurrence pattern generates no bookings. Check the end date and the days selected.'
    })
  }

  // Every occurrence holds its own slot, so every occurrence is checked before
  // any row is written (CLAUDE.md invariant 4).
  if (parentBookingData.roomId || parentBookingData.externalVenueId) {
    const { conflictingOccurrences } = await checkRecurringAvailability(
      pattern,
      baseStartTime,
      baseEndTime,
      parentBookingData.roomId,
      parentBookingData.externalVenueId
    )

    if (conflictingOccurrences.length && !allowConflicts) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Some occurrences are not available',
        data: {
          message: `${conflictingOccurrences.length} of ${occurrences.length} occurrence(s) clash with an existing booking.`,
          occurrences: conflictingOccurrences.map(o => ({
            occurrenceNumber: o.occurrenceNumber,
            startTime: o.startTime,
            endTime: o.endTime
          }))
        }
      })
    }
  }
  const parentBooking = requireRow(await db
    .insert(schema.bookings)
    .values({
      userId: parentBookingData.userId || null,
      eventTitle: parentBookingData.eventTitle,
      numberOfAttendees: parentBookingData.numberOfAttendees,
      startTime: firstOccurrence.startTime,
      endTime: firstOccurrence.endTime,
      roomId: parentBookingData.roomId,
      externalVenueId: parentBookingData.externalVenueId,
      status: parentBookingData.status,
      notes: parentBookingData.notes,
      occurrenceNumber: 1
    })
    .returning())

  // Create the recurring pattern
  const recurringPattern = requireRow(await db
    .insert(schema.recurringPatterns)
    .values({
      bookingId: parentBooking.id,
      frequency: pattern.frequency,
      interval: pattern.interval || 1,
      daysOfWeek: pattern.daysOfWeek ? JSON.stringify(pattern.daysOfWeek) : null,
      maxOccurrences: pattern.maxOccurrences,
      endDate: pattern.endDate
    })
    .returning())

  // One statement per occurrence, so each binds a fixed parameter count
  // (CLAUDE.md 10), but sent in a single round-trip rather than N of them.
  const inserts = occurrences.slice(1).map(occurrence => db
    .insert(schema.bookings)
    .values({
      userId: parentBookingData.userId || null,
      eventTitle: parentBookingData.eventTitle,
      numberOfAttendees: parentBookingData.numberOfAttendees,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      roomId: parentBookingData.roomId,
      externalVenueId: parentBookingData.externalVenueId,
      status: parentBookingData.status,
      notes: parentBookingData.notes,
      parentBookingId: parentBooking.id,
      occurrenceNumber: occurrence.occurrenceNumber
    })
    .returning())

  const childBookings: Booking[] = inserts.length
    ? (await db.batch(inserts as [typeof inserts[number], ...typeof inserts])).map(rows => requireRow(rows))
    : []

  return {
    parentBooking,
    childBookings,
    pattern: recurringPattern
  }
}
