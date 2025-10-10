/**
 * Recurring Booking Utilities
 *
 * Provides functions for generating, validating, and managing
 * recurring booking patterns.
 *
 * @module server/utils/recurring
 */

import type { RecurringPattern, Booking } from '@prisma/client'
import prisma from '~~/server/database'
import { checkRoomAvailability, checkVenueAvailability } from './availability'

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

  let currentDate = new Date(baseStartTime)
  let occurrenceNumber = 1

  // Generate occurrences
  while (occurrenceNumber <= pattern.maxOccurrences) {
    if (pattern.endDate && currentDate > pattern.endDate) {
      break
    }

    if (pattern.frequency === 'DAILY') {
      // Daily recurrence
      const startTime = new Date(currentDate)
      const endTime = new Date(currentDate.getTime() + duration)

      occurrences.push({
        occurrenceNumber,
        startTime,
        endTime
      })

      // Move to next occurrence
      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + interval)
      occurrenceNumber++
    } else if (pattern.frequency === 'WEEKLY') {
      // Weekly recurrence - generate for each specified day of week
      const weekStartDate = new Date(currentDate)
      const selectedDays = pattern.daysOfWeek!.map(day => DAYS_OF_WEEK_MAP[day])

      // For each day in the current week
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const checkDate = new Date(weekStartDate)
        checkDate.setDate(checkDate.getDate() + dayOffset)

        if (selectedDays.includes(checkDate.getDay())) {
          // This day is selected
          const startTime = new Date(checkDate)
          startTime.setHours(baseStartTime.getHours(), baseStartTime.getMinutes(), 0, 0)

          const endTime = new Date(startTime.getTime() + duration)

          // Only add if it's not before the base date and within limits
          if (startTime >= baseStartTime && occurrenceNumber <= pattern.maxOccurrences) {
            if (!pattern.endDate || startTime <= pattern.endDate) {
              occurrences.push({
                occurrenceNumber,
                startTime,
                endTime
              })
              occurrenceNumber++
            }
          }
        }
      }

      // Move to next week(s)
      currentDate = new Date(weekStartDate)
      currentDate.setDate(currentDate.getDate() + (7 * interval))
    } else if (pattern.frequency === 'CUSTOM') {
      // Custom interval in days
      const startTime = new Date(currentDate)
      const endTime = new Date(currentDate.getTime() + duration)

      occurrences.push({
        occurrenceNumber,
        startTime,
        endTime
      })

      currentDate = new Date(currentDate)
      currentDate.setDate(currentDate.getDate() + interval)
      occurrenceNumber++
    }

    // Safety check to prevent infinite loops
    if (occurrences.length > MAX_OCCURRENCES * 10) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Pattern generation error',
        message: 'Too many occurrences generated, please check your pattern'
      })
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
  baseEndTime: Date
): Promise<{
  parentBooking: Booking
  childBookings: Booking[]
  pattern: RecurringPattern
}> {
  const occurrences = generateRecurringOccurrences(pattern, baseStartTime, baseEndTime)

  // Create the parent booking (first occurrence)
  const firstOccurrence = occurrences[0]
  const parentBooking = await prisma.booking.create({
    data: {
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
    }
  })

  // Create the recurring pattern
  const recurringPattern = await prisma.recurringPattern.create({
    data: {
      bookingId: parentBooking.id,
      frequency: pattern.frequency,
      interval: pattern.interval || 1,
      daysOfWeek: pattern.daysOfWeek ? JSON.stringify(pattern.daysOfWeek) : null,
      maxOccurrences: pattern.maxOccurrences,
      endDate: pattern.endDate
    }
  })

  // Create child bookings for remaining occurrences
  const childBookings: Booking[] = []
  for (let i = 1; i < occurrences.length; i++) {
    const occurrence = occurrences[i]
    const childBooking = await prisma.booking.create({
      data: {
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
      }
    })
    childBookings.push(childBooking)
  }

  return {
    parentBooking,
    childBookings,
    pattern: recurringPattern
  }
}

/**
 * Get all bookings in a recurring series
 */
export async function getRecurringSeriesBookings(bookingId: number): Promise<Booking[]> {
  // First, check if this is a parent or child booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { recurringPattern: true }
  })

  if (!booking) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Booking not found'
    })
  }

  // If it has a parent, get the parent ID
  const parentId = booking.parentBookingId || booking.id

  // Get all bookings in the series
  const allBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { id: parentId },
        { parentBookingId: parentId }
      ]
    },
    include: {
      user: true,
      room: true,
      externalVenue: true
    },
    orderBy: {
      occurrenceNumber: 'asc'
    }
  })

  return allBookings
}
