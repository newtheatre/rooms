<script setup lang="ts">
interface Booking {
  id: number
  userId: string | null
  status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
  startTime: string
  endTime: string
}

const { user } = useUserSession()
const { data: bookings } = await useFetch<Booking[]>('/api/bookings')

// Filter to only show current user's bookings (important for admins who get all bookings from API)
const userBookings = computed(() => {
  if (!bookings.value || !user.value?.id) return []
  return bookings.value.filter(b => b.userId === user.value?.id)
})

const stats = computed(() => {
  const all = userBookings.value

  return {
    total: all.length,
    pending: all.filter(b => b.status === 'PENDING').length,
    confirmed: all.filter(b => b.status === 'CONFIRMED').length,
    upcoming: all.filter((b) => {
      return b.status === 'CONFIRMED' && new Date(b.startTime) > new Date()
    }).length
  }
})
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <UIcon
              name="i-lucide-calendar"
              class="w-5 h-5 text-blue-600 dark:text-blue-400"
            />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Total Bookings
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.total }}
            </p>
          </div>
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
            <UIcon
              name="i-lucide-clock"
              class="w-5 h-5 text-yellow-600 dark:text-yellow-400"
            />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Pending
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.pending }}
            </p>
          </div>
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
            <UIcon
              name="i-lucide-check-circle"
              class="w-5 h-5 text-green-600 dark:text-green-400"
            />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Confirmed
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.confirmed }}
            </p>
          </div>
        </div>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <UIcon
              name="i-lucide-calendar-days"
              class="w-5 h-5 text-purple-600 dark:text-purple-400"
            />
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Upcoming
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.upcoming }}
            </p>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>
