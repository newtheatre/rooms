/**
 * Admin: Manage Rooms Page
 *
 * Administrative interface for room management.
 *
 * Features:
 * - Table view of all rooms with selection
 * - Filter by status (Active, Inactive)
 * - Search by room name
 * - View room details (capacity, bookings count, creation date)
 * - Create new rooms
 * - Update room details (name, description, capacity)
 * - Toggle room active status
 * - Delete (deactivate) room(s) - soft delete to preserve booking history
 *
 * Data Loading:
 * - GET /api/rooms
 *
 * Data Mutations:
 * - POST /api/rooms (create room)
 * - PUT /api/rooms/:id (update room)
 * - DELETE /api/rooms/:id (soft delete - set isActive to false)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 * - Redirect to / if user.role !== 'ADMIN' (403)
 *
 * @route /admin/rooms
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = useTemplateRef<any>('table')

// Room type
interface Room {
  id: number
  name: string
  description: string | null
  capacity: number | null
  isActive: boolean
  createdAt: string
  bookingCount: number
}

// Table state
const columnFilters = ref([{
  id: 'name',
  value: ''
}])
const columnVisibility = ref()
const rowSelection = ref<Record<string, boolean>>({})

// Fetch rooms
const { data, status, refresh } = await useFetch<Room[]>('/api/rooms', {
  lazy: true,
  query: { includeInactive: 'true' }
})

// Selected room for actions
const roomToEdit = ref<Room | null>(null)
const roomToDelete = ref<Room | null>(null)
const deleteModalOpen = ref(false)

// Delete single room (permanently)
async function deleteSingleRoom() {
  if (!roomToDelete.value) return

  try {
    await $fetch(`/api/rooms/${roomToDelete.value.id}?permanent=true`, { method: 'DELETE' })
    toast.add({
      title: 'Room deleted',
      description: `${roomToDelete.value.name} has been permanently deleted`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    deleteModalOpen.value = false
    roomToDelete.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete room',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Toggle room active status
async function toggleRoomStatus(room: Room) {
  try {
    await $fetch(`/api/rooms/${room.id}`, {
      method: 'PUT',
      body: { isActive: !room.isActive }
    })
    toast.add({
      title: room.isActive ? 'Room deactivated' : 'Room activated',
      description: `${room.name} is now ${room.isActive ? 'inactive' : 'active'}`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to update room status',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Mass activate selected rooms
async function massActivate() {
  const inactiveRooms = selectedRooms.value.filter(r => !r.isActive)
  if (inactiveRooms.length === 0) {
    toast.add({
      title: 'No inactive rooms',
      description: 'All selected rooms are already active',
      icon: 'i-lucide-info',
      color: 'neutral'
    })
    return
  }

  try {
    await Promise.all(
      inactiveRooms.map(room =>
        $fetch(`/api/rooms/${room.id}`, {
          method: 'PUT',
          body: { isActive: true }
        })
      )
    )
    toast.add({
      title: 'Rooms activated',
      description: `${inactiveRooms.length} room${inactiveRooms.length > 1 ? 's' : ''} activated`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    rowSelection.value = {}
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to activate rooms',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Mass deactivate selected rooms
async function massDeactivate() {
  const activeRooms = selectedRooms.value.filter(r => r.isActive)
  if (activeRooms.length === 0) {
    toast.add({
      title: 'No active rooms',
      description: 'All selected rooms are already inactive',
      icon: 'i-lucide-info',
      color: 'neutral'
    })
    return
  }

  try {
    await Promise.all(
      activeRooms.map(room =>
        $fetch(`/api/rooms/${room.id}`, {
          method: 'PUT',
          body: { isActive: false }
        })
      )
    )
    toast.add({
      title: 'Rooms deactivated',
      description: `${activeRooms.length} room${activeRooms.length > 1 ? 's' : ''} deactivated`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    rowSelection.value = {}
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to deactivate rooms',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Get row actions for dropdown
function getRowItems(row: Row<Room>) {
  const room = row.original

  return [
    {
      type: 'label' as const,
      label: 'Actions'
    },
    {
      label: 'Copy room ID',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(room.id.toString())
        toast.add({
          title: 'Copied to clipboard',
          description: 'Room ID copied to clipboard'
        })
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Edit room',
      icon: 'i-lucide-pencil',
      onSelect() {
        roomToEdit.value = room
      }
    },
    {
      label: room.isActive ? 'Deactivate' : 'Activate',
      icon: room.isActive ? 'i-lucide-toggle-right' : 'i-lucide-toggle-left',
      onSelect() {
        toggleRoomStatus(room)
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Delete room',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      disabled: room.bookingCount > 0,
      onSelect() {
        roomToDelete.value = room
        deleteModalOpen.value = true
      }
    }
  ]
}

// Define table columns
const columns: TableColumn<Room>[] = [
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
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted font-mono' }, row.original.id.toString())
  },
  {
    accessorKey: 'name',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Room Name',
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
      const room = row.original
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, room.name),
        room.description
          ? h('p', { class: 'text-sm text-muted truncate max-w-xs' }, room.description)
          : null
      ])
    }
  },
  {
    accessorKey: 'capacity',
    header: 'Capacity',
    cell: ({ row }) => {
      const capacity = row.original.capacity
      return h('span', { class: 'text-sm text-muted' }, capacity ? capacity.toString() : '—')
    }
  },
  {
    accessorKey: 'bookingCount',
    header: 'Bookings',
    cell: ({ row }) => {
      const count = row.original.bookingCount
      return h('span', { class: 'text-sm text-muted' }, count.toString())
    }
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const room = row.original
      return h(UBadge, {
        color: room.isActive ? 'success' : 'neutral',
        label: room.isActive ? 'Active' : 'Inactive',
        variant: 'subtle'
      })
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt)
      return h('span', { class: 'text-sm text-muted' }, date.toLocaleDateString())
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

// Status filter
const statusFilter = ref('all')

watch(() => statusFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return

  const statusColumn = table.value.tableApi.getColumn('isActive')
  if (!statusColumn) return

  if (newVal === 'all') {
    statusColumn.setFilterValue(undefined)
  } else {
    statusColumn.setFilterValue(newVal === 'active')
  }
})

// Pagination
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

// Get selected rooms for bulk actions
const selectedRooms = computed<Room[]>(() => {
  if (!table.value?.tableApi || !data.value) return []
  return table.value.tableApi.getFilteredSelectedRowModel().rows.map((row: { original: Room }) => row.original)
})
</script>

<template>
  <UDashboardPanel id="rooms">
    <template #header>
      <UDashboardNavbar title="Room Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <RoomsAddModal @refresh="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          :model-value="(table?.tableApi?.getColumn('name')?.getFilterValue() as string)"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Filter rooms..."
          @update:model-value="table?.tableApi?.getColumn('name')?.setFilterValue($event)"
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Bulk Action Buttons (show when rows are selected) -->
          <template v-if="selectedRooms.length > 0">
            <UButton
              label="Deactivate"
              color="warning"
              variant="subtle"
              icon="i-lucide-toggle-left"
              :disabled="selectedRooms.every(r => !r.isActive)"
              @click="massDeactivate"
            >
              <template #trailing>
                <UKbd>
                  {{ selectedRooms.filter(r => r.isActive).length }}
                </UKbd>
              </template>
            </UButton>

            <UButton
              label="Activate"
              color="success"
              variant="subtle"
              icon="i-lucide-toggle-right"
              :disabled="selectedRooms.every(r => r.isActive)"
              @click="massActivate"
            >
              <template #trailing>
                <UKbd>
                  {{ selectedRooms.filter(r => !r.isActive).length }}
                </UKbd>
              </template>
            </UButton>

            <RoomsDeleteModal
              :count="selectedRooms.length"
              :rooms="selectedRooms"
              @refresh="() => { refresh(); rowSelection = {} }"
            >
              <UButton
                label="Delete"
                color="error"
                variant="subtle"
                icon="i-lucide-trash"
                :disabled="selectedRooms.some(r => r.bookingCount > 0)"
              >
                <template #trailing>
                  <UKbd>
                    {{ selectedRooms.length }}
                  </UKbd>
                </template>
              </UButton>
            </RoomsDeleteModal>
          </template>

          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter status"
            class="min-w-28"
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
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default'
        }"
      />

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
        </div>

        <div class="flex items-center gap-1.5">
          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="table?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
          />
        </div>
      </div>

      <!-- Edit Room Modal -->
      <RoomsEditModal :room="roomToEdit" @refresh="() => { refresh(); roomToEdit = null }" />

      <!-- Delete Single Room Modal (from dropdown) -->
      <UModal
        v-model:open="deleteModalOpen"
        :title="`Delete ${roomToDelete?.name || 'room'}`"
        :description="`Are you sure? This action cannot be undone.`"
      >
        <template #body>
          <div v-if="roomToDelete" class="space-y-4">
            <!-- Room has bookings warning -->
            <div v-if="roomToDelete.bookingCount > 0" class="p-3 rounded-md bg-error/10 border border-error/20">
              <div class="flex gap-2">
                <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
                <div class="text-sm text-error">
                  <p class="font-medium mb-1">
                    Cannot Delete Room with Bookings
                  </p>
                  <p>
                    This room has {{ roomToDelete.bookingCount }} existing booking{{ roomToDelete.bookingCount !== 1 ? 's' : '' }}.
                    You must deactivate the room instead to preserve booking history.
                  </p>
                </div>
              </div>
            </div>

            <!-- Deletion Warning -->
            <div v-else class="p-3 rounded-md bg-error/10 border border-error/20">
              <div class="flex gap-2">
                <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
                <div class="text-sm text-error">
                  <p class="font-medium mb-1">
                    What happens when you delete this room:
                  </p>
                  <ul class="list-disc list-inside space-y-1">
                    <li>Room will be permanently deleted from the database</li>
                    <li>This action cannot be undone</li>
                    <li>Room has no existing bookings</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-4">
            <UButton
              label="Cancel"
              color="neutral"
              variant="subtle"
              @click="deleteModalOpen = false"
            />
            <UButton
              label="Delete Room"
              color="error"
              :disabled="roomToDelete?.bookingCount && roomToDelete.bookingCount > 0"
              @click="deleteSingleRoom"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
