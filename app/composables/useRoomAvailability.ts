/**
 * Room availability for the booking forms. The caller decides when to fetch;
 * both currently debounce it themselves.
 */

import { ref, computed } from 'vue'

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

export function useRoomAvailability(options?: {
  includeUnavailable?: boolean
}) {
  const { includeUnavailable = true } = options || {}

  const availableRooms = ref<RoomWithAvailability[]>([])
  const unavailableRooms = ref<RoomWithAvailability[]>([])
  const isLoading = ref(false)

  // Non-null means the last check failed, which is not the same as no clashes.
  const error = ref<unknown>(null)

  const totalAvailable = computed(() => availableRooms.value.length)
  const totalUnavailable = computed(() => unavailableRooms.value.length)

  /** False until a check has come back, so a caller can tell it from a clear one. */
  const hasAvailability = computed(() =>
    availableRooms.value.length > 0 || unavailableRooms.value.length > 0
  )

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
      }>('/api/rooms/available', { query })

      availableRooms.value = data.available
      unavailableRooms.value = data.unavailable
    } catch (err) {
      console.error('Failed to fetch room availability:', err)
      error.value = err
      availableRooms.value = []
      unavailableRooms.value = []
    } finally {
      isLoading.value = false
    }
  }

  return {
    availableRooms,
    unavailableRooms,
    isLoading,
    error,
    hasAvailability,
    totalAvailable,
    totalUnavailable,
    fetchAvailability
  }
}
