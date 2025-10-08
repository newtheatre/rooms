/**
 * Admin: Manage External Venues Page
 *
 * Administrative interface for external venue management.
 *
 * Features:
 * - Table view of all external venues with selection
 * - Filter by campus and search by building/room
 * - View venue details (campus, building, room, contact, bookings count)
 * - Create new venues
 * - Update venue details (campus, building, room name, contact details)
 * - Delete venues (only if no bookings exist)
 *
 * Data Loading:
 * - GET /api/venues
 *
 * Data Mutations:
 * - POST /api/venues (create venue)
 * - PUT /api/venues/:id (update venue)
 * - DELETE /api/venues/:id (hard delete if no bookings)
 *
 * @route /admin/venues
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

definePageMeta({
  middleware: ['admin']
})

const toast = useToast()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = useTemplateRef<any>('table')

// Venue type
interface Venue {
  id: number
  campus: string | null
  building: string
  roomName: string
  contactDetails: string | null
  createdAt: string
  bookingCount: number
}

// Table state
const columnFilters = ref([{
  id: 'building',
  value: ''
}])
const columnVisibility = ref()
const rowSelection = ref<Record<string, boolean>>({})

// Fetch venues
const { data, status, refresh } = await useFetch<Venue[]>('/api/venues', {
  lazy: true
})

// Selected venue for actions
const venueToEdit = ref<Venue | null>(null)
const venueToDelete = ref<Venue | null>(null)
const deleteModalOpen = ref(false)

// Delete single venue (permanently)
async function deleteSingleVenue() {
  if (!venueToDelete.value) return

  try {
    await $fetch(`/api/venues/${venueToDelete.value.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Venue deleted',
      description: `${venueToDelete.value.building} - ${venueToDelete.value.roomName} has been deleted`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    deleteModalOpen.value = false
    venueToDelete.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete venue',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Get row actions for dropdown
function getRowItems(row: Row<Venue>) {
  const venue = row.original

  return [
    {
      type: 'label' as const,
      label: 'Actions'
    },
    {
      label: 'Copy venue ID',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(venue.id.toString())
        toast.add({
          title: 'Copied to clipboard',
          description: 'Venue ID copied to clipboard'
        })
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Edit venue',
      icon: 'i-lucide-pencil',
      onSelect() {
        venueToEdit.value = venue
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Delete venue',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      disabled: venue.bookingCount > 0,
      onSelect() {
        venueToDelete.value = venue
        deleteModalOpen.value = true
      }
    }
  ]
}

// Define table columns
const columns: TableColumn<Venue>[] = [
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
    accessorKey: 'campus',
    header: 'Campus',
    filterFn: 'equals',
    cell: ({ row }) => {
      const campus = row.original.campus
      return h('span', { class: 'text-sm' }, campus || '—')
    }
  },
  {
    accessorKey: 'building',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Location',
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
      const venue = row.original
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, venue.building),
        h('p', { class: 'text-sm text-muted' }, venue.roomName)
      ])
    }
  },
  {
    accessorKey: 'contactDetails',
    header: 'Contact',
    cell: ({ row }) => {
      const contact = row.original.contactDetails
      return h('span', { class: 'text-sm text-muted truncate max-w-xs block' }, contact || '—')
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

// Campus filter
const campusFilter = ref('all')
const uniqueCampuses = computed(() => {
  if (!data.value) return []
  const campuses = [...new Set(data.value.map(v => v.campus).filter(Boolean))] as string[]
  return campuses.sort()
})

watch(() => campusFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return

  const campusColumn = table.value.tableApi.getColumn('campus')
  if (!campusColumn) return

  if (newVal === 'all') {
    campusColumn.setFilterValue(undefined)
  } else if (newVal === 'none') {
    campusColumn.setFilterValue(null)
  } else {
    campusColumn.setFilterValue(newVal)
  }
})

// Pagination
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

// Get selected venues for bulk actions
const selectedVenues = computed<Venue[]>(() => {
  if (!table.value?.tableApi || !data.value) return []
  return table.value.tableApi.getFilteredSelectedRowModel().rows.map((row: { original: Venue }) => row.original)
})
</script>

<template>
  <UDashboardPanel id="venues">
    <template #header>
      <UDashboardNavbar title="External Venue Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <VenuesAddModal @refresh="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          :model-value="(table?.tableApi?.getColumn('building')?.getFilterValue() as string)"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Filter by building or room..."
          @update:model-value="table?.tableApi?.getColumn('building')?.setFilterValue($event)"
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Bulk Delete Button (shows when rows are selected) -->
          <VenuesDeleteModal
            v-if="selectedVenues.length > 0"
            :count="selectedVenues.length"
            :venues="selectedVenues"
            @refresh="() => { refresh(); rowSelection = {} }"
          >
            <UButton
              label="Delete"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
              :disabled="selectedVenues.some(v => v.bookingCount > 0)"
            >
              <template #trailing>
                <UKbd>
                  {{ selectedVenues.length }}
                </UKbd>
              </template>
            </UButton>
          </VenuesDeleteModal>

          <USelect
            v-model="campusFilter"
            :items="[
              { label: 'All Campuses', value: 'all' },
              { label: 'No Campus', value: 'none' },
              ...uniqueCampuses.map(c => ({ label: c, value: c }))
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter campus"
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

      <!-- Edit Venue Modal -->
      <VenuesEditModal :venue="venueToEdit" @refresh="() => { refresh(); venueToEdit = null }" />

      <!-- Delete Single Venue Modal (from dropdown) -->
      <UModal
        v-model:open="deleteModalOpen"
        :title="`Delete ${venueToDelete?.building || 'venue'} - ${venueToDelete?.roomName || ''}`"
        :description="`Are you sure? This action cannot be undone.`"
      >
        <template #body>
          <div v-if="venueToDelete" class="space-y-4">
            <!-- Venue has bookings warning -->
            <div v-if="venueToDelete.bookingCount > 0" class="p-3 rounded-md bg-error/10 border border-error/20">
              <div class="flex gap-2">
                <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
                <div class="text-sm text-error">
                  <p class="font-medium mb-1">
                    Cannot Delete Venue with Bookings
                  </p>
                  <p>
                    This venue has {{ venueToDelete.bookingCount }} existing booking{{ venueToDelete.bookingCount !== 1 ? 's' : '' }}.
                    You must reassign or cancel these bookings first.
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
                    What happens when you delete this venue:
                  </p>
                  <ul class="list-disc list-inside space-y-1">
                    <li>Venue will be permanently deleted from the database</li>
                    <li>This action cannot be undone</li>
                    <li>Venue has no existing bookings</li>
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
              label="Delete Venue"
              color="error"
              :disabled="venueToDelete?.bookingCount && venueToDelete.bookingCount > 0"
              @click="deleteSingleVenue"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
