/**
 * Room and Venue Availability Utilities
 *
 * Provides functions for checking room and venue availability,
 * detecting booking conflicts, and filtering available options.
 *
 * @module server/utils/availability
 */

import type { Booking, Room, ExternalVenue } from '@prisma/client'
import prisma from '~~/server/database'

/**
 * Check if two time ranges overlap
 * Two bookings overlap if: (StartA < EndB) AND (EndA > StartB)
 */
export function hasTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2
}

/**
 * Check availability for a specific room
 *
 * @param roomId - The room ID to check
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @param excludeBookingId - Optional booking ID to exclude (for editing)
 * @returns Object with availability status and any conflicts
 */
export async function checkRoomAvailability(
  roomId: number,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number
): Promise<{
  isAvailable: boolean
  conflicts: Booking[]
}> {
  const conflicts = await prisma.booking.findMany({
    where: {
      roomId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: {
        in: ['CONFIRMED', 'PENDING', 'AWAITING_EXTERNAL']
      },
      // Check for time overlap
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } }
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  })

  return {
    isAvailable: conflicts.length === 0,
    conflicts
  }
}

/**
 * Check availability for a specific external venue
 *
 * @param externalVenueId - The venue ID to check
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @param excludeBookingId - Optional booking ID to exclude (for editing)
 * @returns Object with availability status and any conflicts
 */
export async function checkVenueAvailability(
  externalVenueId: number,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number
): Promise<{
  isAvailable: boolean
  conflicts: Booking[]
}> {
  const conflicts = await prisma.booking.findMany({
    where: {
      externalVenueId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: {
        in: ['CONFIRMED', 'PENDING', 'AWAITING_EXTERNAL']
      },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } }
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  })

  return {
    isAvailable: conflicts.length === 0,
    conflicts
  }
}

/**
 * Get all rooms with their availability status for a given time range
 *
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @param options - Additional options
 * @returns Object with available and unavailable rooms
 */
export async function getAvailableRooms(
  startTime: Date,
  endTime: Date,
  options?: {
    excludeBookingId?: number
    includeInactive?: boolean
  }
): Promise<{
  available: Room[]
  unavailable: Array<Room & { conflicts: Booking[] }>
}> {
  const rooms = await prisma.room.findMany({
    where: {
      isActive: options?.includeInactive ? undefined : true
    },
    orderBy: {
      name: 'asc'
    }
  })

  const available: Room[] = []
  const unavailable: Array<Room & { conflicts: Booking[] }> = []

  for (const room of rooms) {
    const { isAvailable, conflicts } = await checkRoomAvailability(
      room.id,
      startTime,
      endTime,
      options?.excludeBookingId
    )

    if (isAvailable) {
      available.push(room)
    } else {
      unavailable.push({ ...room, conflicts })
    }
  }

  return { available, unavailable }
}

/**
 * Get all external venues with their availability status for a given time range
 *
 * @param startTime - Start time of the requested booking
 * @param endTime - End time of the requested booking
 * @param options - Additional options
 * @returns Object with available and unavailable venues
 */
export async function getAvailableVenues(
  startTime: Date,
  endTime: Date,
  options?: {
    excludeBookingId?: number
  }
): Promise<{
  available: ExternalVenue[]
  unavailable: Array<ExternalVenue & { conflicts: Booking[] }>
}> {
  const venues = await prisma.externalVenue.findMany({
    orderBy: [
      { building: 'asc' },
      { roomName: 'asc' }
    ]
  })

  const available: ExternalVenue[] = []
  const unavailable: Array<ExternalVenue & { conflicts: Booking[] }> = []

  for (const venue of venues) {
    const { isAvailable, conflicts } = await checkVenueAvailability(
      venue.id,
      startTime,
      endTime,
      options?.excludeBookingId
    )

    if (isAvailable) {
      available.push(venue)
    } else {
      unavailable.push({ ...venue, conflicts })
    }
  }

  return { available, unavailable }
}

/**
 * Validate that a booking doesn't conflict with existing bookings
 * Throws an error if conflicts are found
 *
 * @param roomId - Optional room ID
 * @param externalVenueId - Optional external venue ID
 * @param startTime - Start time
 * @param endTime - End time
 * @param excludeBookingId - Optional booking to exclude
 * @param allowConflicts - Whether to allow conflicts (admin override)
 */
export async function validateBookingAvailability(
  roomId: number | undefined | null,
  externalVenueId: number | undefined | null,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: number,
  allowConflicts = false
): Promise<void> {
  if (roomId) {
    const { isAvailable, conflicts } = await checkRoomAvailability(
      roomId,
      startTime,
      endTime,
      excludeBookingId
    )

    if (!isAvailable && !allowConflicts) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Room is not available',
        data: {
          message: `This room is already booked for the selected time. Found ${conflicts.length} conflicting booking(s).`,
          conflicts: conflicts.map(c => ({
            id: c.id,
            eventTitle: c.eventTitle,
            startTime: c.startTime,
            endTime: c.endTime,
            status: c.status
          }))
        }
      })
    }
  }

  if (externalVenueId) {
    const { isAvailable, conflicts } = await checkVenueAvailability(
      externalVenueId,
      startTime,
      endTime,
      excludeBookingId
    )

    if (!isAvailable && !allowConflicts) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Venue is not available',
        data: {
          message: `This venue is already booked for the selected time. Found ${conflicts.length} conflicting booking(s).`,
          conflicts: conflicts.map(c => ({
            id: c.id,
            eventTitle: c.eventTitle,
            startTime: c.startTime,
            endTime: c.endTime,
            status: c.status
          }))
        }
      })
    }
  }
}
