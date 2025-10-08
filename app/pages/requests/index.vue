/**
 * User Booking Requests Page
 *
 * Lists all booking requests made by the current user.
 *
 * Features:
 * - Table/list view of user's bookings
 * - Status badges (PENDING, CONFIRMED, AWAITING_EXTERNAL, REJECTED, CANCELLED)
 * - Filter by status
 * - Sort by date (ascending/descending)
 * - Quick actions: View details, Cancel booking (if PENDING or CONFIRMED)
 * - Show rejection reason for REJECTED bookings
 * - Empty state with "Create booking" CTA
 *
 * Data Loading:
 * - GET /api/bookings (returns only user's bookings for STANDARD users)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 *
 * @route /requests
 * @authenticated
 */
<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'

definePageMeta({
  middleware: ['auth']
})

interface Booking {
  id: number
  userId: string | null
  roomId: number | null
  externalVenueId: number | null
  eventTitle: string
  numberOfAttendees: number | null
  startTime: string
  endTime: string
  status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
  notes: string | null
  rejectionReason: string | null
  room?: {
    id: number
    name: string
  }
  externalVenue?: {
    id: number
    building: string
    roomName: string
  }
}

const toast = useToast()
const df = new DateFormatter('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const { user } = useUserSession()

// State
const searchQuery = ref('')
const statusFilter = ref<string | undefined>(undefined)
const page = ref(1)
const pageSize = ref(10)

// Fetch bookings
const { data: bookings, status, refresh } = await useFetch<Booking[]>('/api/bookings')

// Filter to only show current user's bookings (important for admins who get all bookings from API)
const userBookings = computed(() => {
  if (!bookings.value || !user.value?.id) return []
  return bookings.value.filter(b => b.userId === user.value?.id)
})

const bookingsData = computed(() => userBookings.value)

// Filter and search
const filteredBookings = computed(() => {
  let filtered = bookingsData.value

  // Status filter
  if (statusFilter.value && statusFilter.value !== 'all') {
    filtered = filtered.filter(b => b.status === statusFilter.value)
  }

  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(b =>
      b.eventTitle.toLowerCase().includes(query)
      || b.notes?.toLowerCase().includes(query)
    )
  }

  return filtered
})

// Pagination
const paginatedBookings = computed(() => {
  const start = (page.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredBookings.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredBookings.value.length / pageSize.value))

// Status options
const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'AWAITING_EXTERNAL', label: 'Awaiting External' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' }
]

// Table columns - using accessorKey like admin page with cell render functions
const columns = [
  {
    accessorKey: 'eventTitle',
    header: 'Event',
    cell: ({ row }: { row: { original: Booking } }) => {
      const booking = row.original
      return h('div', undefined, [
        h('p', { class: 'font-medium text-gray-900 dark:text-white' }, booking.eventTitle),
        booking.numberOfAttendees
          ? h('p', { class: 'text-sm text-gray-500 dark:text-gray-400' }, `${booking.numberOfAttendees} attendees`)
          : null
      ].filter(Boolean))
    }
  },
  {
    accessorKey: 'startTime',
    header: 'Date & Time',
    cell: ({ row }: { row: { original: Booking } }) => {
      const booking = row.original
      const start = new Date(booking.startTime)
      const end = new Date(booking.endTime)
      return h('div', { class: 'text-sm' }, [
        h('div', { class: 'font-medium' }, df.format(start)),
        h('div', { class: 'text-gray-500 dark:text-gray-400' },
          `to ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        )
      ])
    }
  },
  {
    accessorKey: 'venue',
    header: 'Venue',
    cell: ({ row }: { row: { original: Booking } }) => {
      return h('div', { class: 'text-sm' }, formatVenue(row.original))
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }: { row: { original: Booking } }) => {
      const booking = row.original
      const badge = getStatusBadge(booking.status)
      const children = [
        h(resolveComponent('UBadge'), {
          color: badge.color,
          label: badge.label,
          icon: badge.icon,
          variant: 'subtle'
        })
      ]

      // Add rejection reason if rejected
      if (booking.status === 'REJECTED' && booking.rejectionReason) {
        children.push(
          h('div', { class: 'text-xs text-red-600 dark:text-red-400 mt-1' }, booking.rejectionReason)
        )
      }

      // Add notes if present
      if (booking.notes) {
        children.push(
          h('div', { class: 'text-xs text-gray-500 dark:text-gray-400 mt-1' }, [
            h(resolveComponent('UIcon'), { name: 'i-lucide-sticky-note', class: 'w-3 h-3 inline' }),
            ' ',
            booking.notes
          ])
        )
      }

      return h('div', { class: 'space-y-2' }, children)
    }
  },
  {
    accessorKey: 'actions',
    header: '',
    cell: ({ row }: { row: { original: Booking } }) => {
      const actions = getRowActions(row.original)
      if (actions.length === 0) return null

      return h(resolveComponent('UDropdownMenu'), {
        items: actions
      }, {
        default: () => h(resolveComponent('UButton'), {
          icon: 'i-lucide-more-vertical',
          variant: 'ghost',
          color: 'neutral'
        })
      })
    }
  }
]

// Status badge config
function getStatusBadge(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return { color: 'success' as const, label: 'Confirmed', icon: 'i-lucide-check-circle' }
    case 'PENDING':
      return { color: 'warning' as const, label: 'Pending', icon: 'i-lucide-clock' }
    case 'AWAITING_EXTERNAL':
      return { color: 'info' as const, label: 'Awaiting External', icon: 'i-lucide-hourglass' }
    case 'REJECTED':
      return { color: 'error' as const, label: 'Rejected', icon: 'i-lucide-x-circle' }
    case 'CANCELLED':
      return { color: 'neutral' as const, label: 'Cancelled', icon: 'i-lucide-ban' }
    default:
      return { color: 'neutral' as const, label: status, icon: 'i-lucide-circle' }
  }
}

// Format venue
function formatVenue(booking: Booking) {
  if (booking.room) {
    return booking.room.name
  } else if (booking.externalVenue) {
    return `${booking.externalVenue.building} - ${booking.externalVenue.roomName}`
  }
  return 'Not assigned'
}

// Check if booking can be cancelled
function canCancel(booking: Booking) {
  return (booking.status === 'PENDING' || booking.status === 'CONFIRMED')
    && new Date(booking.endTime) > new Date()
}

// Cancel booking
const bookingToCancel = ref<Booking | null>(null)
const isCancelling = ref(false)

async function cancelBooking() {
  if (!bookingToCancel.value) return

  isCancelling.value = true
  try {
    await $fetch(`/api/bookings/${bookingToCancel.value.id}`, {
      method: 'PUT',
      body: {
        status: 'CANCELLED'
      }
    })

    toast.add({
      title: 'Booking cancelled',
      description: 'Your booking has been successfully cancelled.',
      icon: 'i-lucide-check',
      color: 'success'
    })

    bookingToCancel.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to cancel booking',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isCancelling.value = false
  }
}

// Row actions
function getRowActions(booking: Booking) {
  const actions = []

  if (canCancel(booking)) {
    actions.push({
      label: 'Cancel Booking',
      icon: 'i-lucide-x',
      color: 'error' as const,
      onSelect: () => {
        bookingToCancel.value = booking
      }
    })
  }

  return actions
}
</script>

<template>
  <UDashboardPanel id="requests">
    <template #header>
      <UDashboardNavbar title="My Booking Requests">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <BookingsUserCreateModal @refresh="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Filters -->
      <div class="flex flex-col sm:flex-row gap-4 mb-6">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search bookings..."
          class="flex-1"
        />

        <USelectMenu
          v-model="statusFilter"
          :items="statusOptions"
          value-key="value"
          placeholder="Filter by status"
          class="w-full sm:w-48"
        />
      </div>

      <!-- Loading State -->
      <div
        v-if="status === 'pending'"
        class="flex justify-center items-center py-12"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 animate-spin text-gray-400"
        />
      </div>

      <!-- Empty State -->
      <UCard
        v-else-if="paginatedBookings.length === 0 && !searchQuery && !statusFilter"
        class="text-center py-12"
      >
        <div class="flex flex-col items-center gap-4">
          <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
            <UIcon
              name="i-lucide-calendar-x"
              class="w-12 h-12 text-gray-400"
            />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              No bookings yet
            </h3>
            <p class="text-gray-500 dark:text-gray-400">
              You haven't made any booking requests. Create your first booking to get started!
            </p>
          </div>
          <BookingsUserCreateModal @refresh="refresh" />
        </div>
      </UCard>

      <!-- No Results -->
      <UCard
        v-else-if="paginatedBookings.length === 0"
        class="text-center py-12"
      >
        <div class="flex flex-col items-center gap-4">
          <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
            <UIcon
              name="i-lucide-search-x"
              class="w-12 h-12 text-gray-400"
            />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              No bookings found
            </h3>
            <p class="text-gray-500 dark:text-gray-400">
              Try adjusting your filters or search query.
            </p>
          </div>
          <UButton
            label="Clear Filters"
            variant="subtle"
            @click="() => { searchQuery = ''; statusFilter = undefined }"
          />
        </div>
      </UCard>

      <!-- Table -->
      <div v-else>
        <UTable
          :data="paginatedBookings"
          :columns="columns"
        />

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex justify-between items-center mt-6"
        >
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Showing {{ ((page - 1) * pageSize) + 1 }} to {{ Math.min(page * pageSize, filteredBookings.length) }} of {{ filteredBookings.length }} bookings
          </div>

          <UPagination
            v-model="page"
            :total="totalPages"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Cancel Confirmation Modal -->
  <UModal
    :open="!!bookingToCancel"
    title="Cancel Booking"
    :description="`Are you sure you want to cancel the booking for '${bookingToCancel?.eventTitle}'?`"
    @update:open="(val: boolean) => { if (!val) bookingToCancel = null }"
  >
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Keep Booking"
          color="neutral"
          variant="subtle"
          @click="bookingToCancel = null"
        />
        <UButton
          label="Cancel Booking"
          color="error"
          icon="i-lucide-x"
          :loading="isCancelling"
          @click="cancelBooking"
        />
      </div>
    </template>
  </UModal>
</template>
