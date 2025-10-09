/**
 * Room Availability Composable
 *
 * Provides reactive room availability checking for booking forms.
 * Automatically fetches available/unavailable rooms when date/time changes.
 */

import { ref, computed, watch } from 'vue'
import type { CalendarDate } from '@internationalized/date'
import { debounce } from 'perfect-debounce'

export interface RoomWithAvailability {
  id: number
  name: string
  description?: string | null
  capacity?: number | null
  isActive: boolean
  conflicts?: Array<{
    id: number
    eventTitle: string
    startTime: string
    endTime: string
    status: string
    user?: {
      id: string
      name: string
      email: string
    }
  }>
}

export interface VenueWithAvailability {
  id: number
  building: string
  roomName: string
  contactDetails?: string | null
  conflicts?: Array<{
    id: number
    eventTitle: string
    startTime: string
    endTime: string
    status: string
  }>
}

export function useRoomAvailability(options?: {
  autoFetch?: boolean
  debounceMs?: number
  includeUnavailable?: boolean
}) {
  const {
    autoFetch = true,
    debounceMs = 500,
    includeUnavailable = true
  } = options || {}

  const availableRooms = ref<RoomWithAvailability[]>([])
  const unavailableRooms = ref<RoomWithAvailability[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const totalAvailable = computed(() => availableRooms.value.length)
  const totalUnavailable = computed(() => unavailableRooms.value.length)
  const hasRooms = computed(() => totalAvailable.value + totalUnavailable.value > 0)

  /**
   * Fetch room availability for a given time range
   */
  async function fetchAvailability(
    startTime: string | Date,
    endTime: string | Date,
    excludeBookingId?: number
  ) {
    isLoading.value = true
    error.value = null

    try {
      const startStr = startTime instanceof Date ? startTime.toISOString() : startTime
      const endStr = endTime instanceof Date ? endTime.toISOString() : endTime

      const query: Record<string, string> = {
        startTime: startStr,
        endTime: endStr,
        includeUnavailable: includeUnavailable.toString()
      }

      if (excludeBookingId) {
        query.excludeBookingId = excludeBookingId.toString()
      }

      const data = await $fetch<{
        available: RoomWithAvailability[]
        unavailable: RoomWithAvailability[]
        totalAvailable: number
        totalUnavailable: number
      }>('/api/rooms/available', { query })

      availableRooms.value = data.available
      unavailableRooms.value = data.unavailable
    } catch (err) {
      console.error('Failed to fetch room availability:', err)
      error.value = err instanceof Error ? err.message : 'Failed to fetch availability'
      availableRooms.value = []
      unavailableRooms.value = []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create debounced version of fetch
   */
  const debouncedFetch = debounce(fetchAvailability, debounceMs)

  /**
   * Setup automatic fetching when date/time changes
   */
  function watchDateTimeChanges(
    eventDate: Ref<CalendarDate | undefined>,
    startTime: Ref<string | undefined>,
    endTime: Ref<string | undefined>
  ) {
    if (!autoFetch) return

    watch(
      [eventDate, startTime, endTime],
      () => {
        if (eventDate.value && startTime.value && endTime.value) {
          try {
            const combined = combineDateAndTime(eventDate.value, startTime.value)
            const combinedEnd = combineDateAndTime(eventDate.value, endTime.value)
            debouncedFetch(combined, combinedEnd)
          } catch (err) {
            console.error('Invalid date/time combination:', err)
          }
        }
      },
      { immediate: false }
    )
  }

  /**
   * Get room item with availability badge for select menu
   */
  function getRoomItems(showUnavailable = false) {
    interface RoomItem {
      id: number
      label: string
      description: string | null | undefined
      capacity: number | null | undefined
      isAvailable: boolean
      conflicts: Array<{
        id: number
        eventTitle: string
        startTime: string
        endTime: string
        status: string
        user?: {
          id: string
          name: string
          email: string
        }
      }>
    }

    const items: RoomItem[] = availableRooms.value.map(room => ({
      id: room.id,
      label: room.name,
      description: room.description,
      capacity: room.capacity,
      isAvailable: true,
      conflicts: []
    }))

    if (showUnavailable) {
      items.push(...unavailableRooms.value.map(room => ({
        id: room.id,
        label: room.name,
        description: room.description,
        capacity: room.capacity,
        isAvailable: false,
        conflicts: room.conflicts || []
      })))
    }

    return items
  }

  /**
   * Check if a specific room is available
   */
  function isRoomAvailable(roomId: number): boolean {
    return availableRooms.value.some(room => room.id === roomId)
  }

  /**
   * Get conflicts for a specific room
   */
  function getRoomConflicts(roomId: number) {
    const room = unavailableRooms.value.find(r => r.id === roomId)
    return room?.conflicts || []
  }

  /**
   * Reset state
   */
  function reset() {
    availableRooms.value = []
    unavailableRooms.value = []
    error.value = null
    isLoading.value = false
  }

  return {
    // State
    availableRooms,
    unavailableRooms,
    isLoading,
    error,

    // Computed
    totalAvailable,
    totalUnavailable,
    hasRooms,

    // Methods
    fetchAvailability,
    debouncedFetch,
    watchDateTimeChanges,
    getRoomItems,
    isRoomAvailable,
    getRoomConflicts,
    reset
  }
}
