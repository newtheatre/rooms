/**
 * Admin: Manage Bookings Page
 *
 * Administrative interface for reviewing and managing all booking requests.
 * Organized with tabs: Pending (priority) and All Bookings (complete list).
 *
 * Features:
 * - Tab-based organization (Pending / All)
 * - Filter by status within each tab
 * - Search bookings by event title or user name
 * - Bulk actions (reject, delete)
 * - Quick actions for pending bookings:
 *   - Approve & Assign Internal Room → Status: CONFIRMED
 *   - Initiate External Booking → Status: AWAITING_EXTERNAL
 *   - Confirm External Booking → Status: CONFIRMED
 *   - Reject with reason → Status: REJECTED
 * - Manual booking creation
 * - Delete bookings
 * - Pagination and column visibility controls
 *
 * @route /admin/bookings
 * @authenticated
 * @admin-only
 */
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { upperFirst } from 'scule'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'

const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')
const UBadge = resolveComponent('UBadge')

definePageMeta({
  middleware: ['admin']
})

const toast = useToast()
const route = useRoute()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = useTemplateRef<any>('table')

// Types
interface User {
  id: string
  name: string
  email: string
}

interface Room {
  id: number
  name: string
  isActive: boolean
}

interface ExternalVenue {
  id: number
  campus: string | null
  building: string
  roomName: string
}

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
  createdAt: string
  user: User | null
  room: Room | null
  externalVenue: ExternalVenue | null
}

// Tab state
const activeTab = ref((route.query.tab as string) || 'pending')

// Table state
const columnFilters = ref([{
  id: 'eventTitle',
  value: ''
}])
const columnVisibility = ref()
const rowSelection = ref<Record<string, boolean>>({})
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

// Fetch data
const { data: bookings, status, refresh: refreshBookings } = await useFetch<Booking[]>('/api/bookings', {
  lazy: true
})

const { data: rooms } = await useFetch<Room[]>('/api/rooms', {
  query: { includeInactive: 'false' }
})

const { data: venues } = await useFetch<ExternalVenue[]>('/api/venues')

// Modals - modals handle their own state and API calls
const bookingToEdit = ref<Booking | null>(null)
const editModalOpen = ref(false)
const bookingToReject = ref<Booking | null>(null)
const bookingToDelete = ref<Booking | null>(null)

// Check if a booking is historical (in the past)
function isHistorical(booking: Booking): boolean {
  return new Date(booking.endTime) < new Date()
}

// Computed filtered bookings for the current tab
const filteredBookings = computed(() => {
  if (!bookings.value) return []

  // Filter by tab
  if (activeTab.value === 'pending') {
    // Pending tab includes PENDING and AWAITING_EXTERNAL
    return bookings.value.filter(b => b.status === 'PENDING' || b.status === 'AWAITING_EXTERNAL')
  }

  // All tab shows everything
  return bookings.value
})

// Get selected bookings for bulk actions
const selectedBookings = computed<Booking[]>(() => {
  if (!table.value?.tableApi || !bookings.value) return []
  return table.value.tableApi.getFilteredSelectedRowModel().rows.map((row: { original: Booking }) => row.original)
})

// Status badge configuration
const getStatusColor = (status: Booking['status']) => {
  switch (status) {
    case 'PENDING': return 'warning'
    case 'CONFIRMED': return 'success'
    case 'AWAITING_EXTERNAL': return 'info'
    case 'REJECTED': return 'error'
    case 'CANCELLED': return 'neutral'
    default: return 'neutral'
  }
}

const getStatusLabel = (status: Booking['status']) => {
  switch (status) {
    case 'PENDING': return 'Pending'
    case 'CONFIRMED': return 'Confirmed'
    case 'AWAITING_EXTERNAL': return 'Awaiting External'
    case 'REJECTED': return 'Rejected'
    case 'CANCELLED': return 'Cancelled'
    default: return status
  }
}

// Assign internal room
async function assignRoom(booking: Booking, roomId: number) {
  try {
    await $fetch(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      body: {
        roomId,
        status: 'CONFIRMED'
      }
    })
    toast.add({
      title: 'Room assigned',
      description: `Booking confirmed for ${booking.eventTitle}`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    await refreshBookings()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to assign room',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Initiate external booking (no venue assignment yet)
async function initiateExternal(booking: Booking) {
  try {
    await $fetch(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      body: {
        status: 'AWAITING_EXTERNAL'
      }
    })
    toast.add({
      title: 'External booking initiated',
      description: `${booking.eventTitle} is now awaiting external confirmation`,
      icon: 'i-lucide-clock',
      color: 'info'
    })
    await refreshBookings()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to initiate external booking',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Confirm and assign external venue (combines assign + confirm in one step)
async function confirmAndAssignVenue(booking: Booking, venueId: number) {
  try {
    await $fetch(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      body: {
        externalVenueId: venueId,
        status: 'CONFIRMED'
      }
    })
    toast.add({
      title: 'Venue assigned and confirmed',
      description: `${booking.eventTitle} has been confirmed`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    await refreshBookings()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to confirm booking',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Bulk reject selected bookings
async function bulkReject() {
  const pendingBookings = selectedBookings.value.filter(b => b.status === 'PENDING')
  if (pendingBookings.length === 0) {
    toast.add({
      title: 'No pending bookings',
      description: 'Only pending bookings can be rejected',
      icon: 'i-lucide-info',
      color: 'neutral'
    })
    return
  }

  try {
    await Promise.all(
      pendingBookings.map(booking =>
        $fetch(`/api/bookings/${booking.id}`, {
          method: 'PUT',
          body: {
            status: 'REJECTED',
            rejectionReason: 'Bulk rejection'
          }
        })
      )
    )
    toast.add({
      title: 'Bookings rejected',
      description: `${pendingBookings.length} booking(s) have been rejected`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    rowSelection.value = {}
    await refreshBookings()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to reject bookings',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Bulk delete selected bookings
async function bulkDelete() {
  if (selectedBookings.value.length === 0) return

  try {
    await Promise.all(
      selectedBookings.value.map(booking =>
        $fetch(`/api/bookings/${booking.id}`, { method: 'DELETE' })
      )
    )
    toast.add({
      title: 'Bookings deleted',
      description: `${selectedBookings.value.length} booking(s) have been deleted`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    rowSelection.value = {}
    await refreshBookings()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete bookings',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Get row actions
function getRowItems(row: Row<Booking>) {
  const booking = row.original
  const items = []

  items.push({
    type: 'label' as const,
    label: 'Actions'
  })

  // Assign internal room (PENDING or AWAITING_EXTERNAL)
  // For AWAITING_EXTERNAL, this allows canceling external and using internal instead
  if ((booking.status === 'PENDING' || booking.status === 'AWAITING_EXTERNAL') && rooms.value && rooms.value.length > 0) {
    items.push({
      label: booking.status === 'PENDING' ? 'Approve & Assign Room' : 'Cancel External & Assign Room',
      icon: 'i-lucide-door-open',
      children: rooms.value.map(room => ({
        label: room.name,
        onSelect: () => assignRoom(booking, room.id)
      }))
    })
  }

  // Initiate external booking (PENDING only) - no venue assignment, just status change
  if (booking.status === 'PENDING') {
    items.push({
      label: 'Initiate External Booking',
      icon: 'i-lucide-map-pin',
      onSelect: () => initiateExternal(booking)
    })
  }

  // Confirm and assign venue (AWAITING_EXTERNAL only)
  if (booking.status === 'AWAITING_EXTERNAL' && venues.value && venues.value.length > 0) {
    items.push({
      label: 'Confirm & Assign Venue',
      icon: 'i-lucide-check-circle',
      children: venues.value.map(venue => ({
        label: `${venue.building} - ${venue.roomName}`,
        onSelect: () => confirmAndAssignVenue(booking, venue.id)
      }))
    })
  }

  items.push({
    type: 'separator' as const
  })

  // Edit booking (non-historical only)
  if (!isHistorical(booking)) {
    items.push({
      label: 'Edit Booking',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        bookingToEdit.value = booking
        editModalOpen.value = true
      }
    })
  }

  // Reject (PENDING or AWAITING_EXTERNAL only)
  if (booking.status === 'PENDING' || booking.status === 'AWAITING_EXTERNAL') {
    items.push({
      label: 'Reject Request',
      icon: 'i-lucide-x-circle',
      color: 'warning' as const,
      onSelect: () => {
        bookingToReject.value = booking
      }
    })
  }

  // Delete
  items.push({
    label: 'Delete Booking',
    icon: 'i-lucide-trash',
    color: 'error' as const,
    onSelect: () => {
      bookingToDelete.value = booking
    }
  })

  return items
}

// Table columns
const columns: TableColumn<Booking>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          row.toggleSelected(!!value),
        'ariaLabel': 'Select row'
      })
  },
  {
    accessorKey: 'eventTitle',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Event',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) => {
      const booking = row.original

      // Build notes popover if present
      const notesPopover = booking.notes
        ? h(resolveComponent('UPopover'), {
            mode: 'hover'
          }, {
            default: () => h(resolveComponent('UButton'), {
              icon: 'i-lucide-sticky-note',
              color: 'primary',
              variant: 'ghost',
              size: 'xs',
              class: 'cursor-help'
            }),
            content: () => h('div', {
              class: 'p-4 max-w-sm'
            }, [
              h('p', { class: 'text-sm font-semibold mb-2' }, 'Notes'),
              h('p', { class: 'text-sm whitespace-pre-wrap' }, booking.notes || '')
            ])
          })
        : null

      // Build the cell content
      const children = [
        h('p', { class: 'font-medium text-highlighted flex items-center gap-2' }, [
          booking.eventTitle,
          notesPopover
        ].filter(Boolean)),
        h('p', { class: 'text-sm text-muted' }, booking.user?.name || 'Unknown User')
      ]

      return h('div', undefined, children)
    }
  },
  {
    accessorKey: 'startTime',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Date & Time',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    },
    cell: ({ row }) => {
      const start = new Date(row.original.startTime)
      const end = new Date(row.original.endTime)
      return h('div', undefined, [
        h('p', { class: 'text-sm font-medium' }, start.toLocaleDateString()),
        h('p', { class: 'text-sm text-muted' },
          `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        )
      ])
    }
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const booking = row.original
      if (booking.room) {
        return h('div', undefined, [
          h('p', { class: 'text-sm font-medium' }, booking.room.name),
          h('p', { class: 'text-sm text-muted' }, 'Internal Room')
        ])
      } else if (booking.externalVenue) {
        return h('div', undefined, [
          h('p', { class: 'text-sm font-medium' }, booking.externalVenue.building),
          h('p', { class: 'text-sm text-muted' }, booking.externalVenue.roomName)
        ])
      } else {
        return h('span', { class: 'text-sm text-muted' }, 'Not assigned')
      }
    }
  },
  {
    accessorKey: 'numberOfAttendees',
    header: 'Attendees',
    cell: ({ row }) => {
      const count = row.original.numberOfAttendees
      return h('span', { class: 'text-sm text-muted' }, count ? count.toString() : '—')
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const booking = row.original
      return h(UBadge, {
        color: getStatusColor(booking.status),
        label: getStatusLabel(booking.status),
        variant: 'subtle'
      })
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return h(
        'div',
        { class: 'text-right' },
        h(
          UDropdownMenu,
          {
            content: {
              align: 'end'
            },
            items: getRowItems(row)
          },
          () =>
            h(UButton, {
              icon: 'i-lucide-ellipsis-vertical',
              color: 'neutral',
              variant: 'ghost',
              class: 'ml-auto'
            })
        )
      )
    }
  }
]

// Status filter for the All tab
const statusFilter = ref('all')

// Watch both tab changes and status filter
watch(() => activeTab.value, () => {
  // Clear status filter when switching tabs
  if (!table?.value?.tableApi) return
  const statusColumn = table.value.tableApi.getColumn('status')
  if (!statusColumn) return
  statusColumn.setFilterValue(undefined)
  statusFilter.value = 'all'
})

watch(() => statusFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return
  if (activeTab.value !== 'all') return // Only apply filter on All tab

  const statusColumn = table.value.tableApi.getColumn('status')
  if (!statusColumn) return

  if (newVal === 'all') {
    statusColumn.setFilterValue(undefined)
  } else {
    statusColumn.setFilterValue(newVal)
  }
})
</script>

<template>
  <UDashboardPanel id="bookings">
    <template #header>
      <UDashboardNavbar title="Booking Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <BookingsCreateModal @refresh="refreshBookings" />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UTabs
          v-model="activeTab"
          :items="[
            { value: 'pending', label: 'Pending', icon: 'i-lucide-clock' },
            { value: 'all', label: 'All Bookings', icon: 'i-lucide-list' }
          ]"
          class="w-full mt-2"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          :model-value="(table?.tableApi?.getColumn('eventTitle')?.getFilterValue() as string)"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Filter bookings..."
          @update:model-value="table?.tableApi?.getColumn('eventTitle')?.setFilterValue($event)"
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Bulk Action Buttons (show when rows are selected) -->
          <template v-if="selectedBookings.length > 0">
            <UButton
              label="Reject"
              color="warning"
              variant="subtle"
              icon="i-lucide-x-circle"
              :disabled="selectedBookings.every(b => b.status !== 'PENDING')"
              @click="bulkReject"
            >
              <template #trailing>
                <UKbd>
                  {{ selectedBookings.filter(b => b.status === 'PENDING').length }}
                </UKbd>
              </template>
            </UButton>

            <UButton
              label="Delete"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              @click="bulkDelete"
            >
              <template #trailing>
                <UKbd>
                  {{ selectedBookings.length }}
                </UKbd>
              </template>
            </UButton>
          </template>

          <!-- Status Filter (only on All tab) -->
          <USelect
            v-if="activeTab === 'all'"
            v-model="statusFilter"
            :items="[
              { label: 'All Statuses', value: 'all' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Confirmed', value: 'CONFIRMED' },
              { label: 'Awaiting External', value: 'AWAITING_EXTERNAL' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Cancelled', value: 'CANCELLED' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter status"
            class="min-w-40"
          />

          <UDropdownMenu
            :items="
              table?.tableApi
                ?.getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => ({
                  label: upperFirst(column.id),
                  type: 'checkbox' as const,
                  checked: column.getIsVisible(),
                  onUpdateChecked(checked: boolean) {
                    table?.tableApi?.getColumn(column.id)?.toggleVisibility(!!checked)
                  },
                  onSelect(e?: Event) {
                    e?.preventDefault()
                  }
                }))
            "
            :content="{ align: 'end' }"
          >
            <UButton
              label="Display"
              color="neutral"
              variant="outline"
              trailing-icon="i-lucide-settings-2"
            />
          </UDropdownMenu>
        </div>
      </div>

      <UTable
        ref="table"
        v-model:column-filters="columnFilters"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel()
        }"
        class="shrink-0"
        :data="filteredBookings"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0'
        }"
      />

      <!-- Modals -->
      <BookingsEditModal
        v-model:open="editModalOpen"
        :booking="bookingToEdit"
        @refresh="() => { refreshBookings(); bookingToEdit = null; editModalOpen = false }"
      />

      <BookingsRejectModal
        :booking="bookingToReject"
        @refresh="refreshBookings"
      />

      <BookingsDeleteModal
        :booking="bookingToDelete"
        @refresh="refreshBookings"
      />
    </template>
  </UDashboardPanel>
</template>
