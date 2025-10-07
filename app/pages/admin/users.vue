/**
 * Admin: Manage Users Page
 *
 * Administrative interface for user account management.
 *
 * Features:
 * - Table view of all user accounts with selection
 * - Filter by role (ADMIN, STANDARD)
 * - Search by name or email
 * - View user details (bookings count, account creation date)
 * - Create new user accounts
 * - Update user role (STANDARD ↔ ADMIN)
 * - Delete user account(s) (confirmation required, bulk supported)
 * - Note: Deleting user sets bookings.userId to NULL (preserves booking history)
 *
 * Data Loading:
 * - GET /api/users
 *
 * Data Mutations:
 * - POST /api/users (create user)
 * - PUT /api/users/:id (update role)
 * - DELETE /api/users/:id (delete account)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 * - Redirect to / if user.role !== 'ADMIN' (403)
 * - Prevent self-deletion or self-role-change (UI safeguard)
 *
 * @route /admin/users
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
const USelect = resolveComponent('USelect')

definePageMeta({
  middleware: ['admin']
})

const { user: currentUser } = useUserSession()
const toast = useToast()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = useTemplateRef<any>('table')

// User type
interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'STANDARD'
  createdAt: string
  bookingCount: number
}

// Table state
const columnFilters = ref([{
  id: 'email',
  value: ''
}])
const columnVisibility = ref()
const rowSelection = ref<Record<string, boolean>>({})

// Fetch users
const { data, status, refresh } = await useFetch<User[]>('/api/users', {
  lazy: true
})

// Selected user for editing
const selectedUser = ref<User | null>(null)
const userForPasswordReset = ref<User | null>(null)
const userToEdit = ref<User | null>(null)
const userToDelete = ref<User | null>(null)
const deleteModalOpen = ref(false)

// Delete single user
async function deleteSingleUser() {
  if (!userToDelete.value) return

  try {
    await $fetch(`/api/users/${userToDelete.value.id}`, { method: 'DELETE' })
    toast.add({
      title: 'User deleted',
      description: `${userToDelete.value.name} has been removed`,
      icon: 'i-lucide-check',
      color: 'success'
    })
    deleteModalOpen.value = false
    userToDelete.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete user',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}

// Get row actions for dropdown
function getRowItems(row: Row<User>) {
  const user = row.original
  const isSelf = user.id === currentUser.value?.id

  return [
    {
      type: 'label' as const,
      label: 'Actions'
    },
    {
      label: 'Copy user ID',
      icon: 'i-lucide-copy',
      onSelect() {
        navigator.clipboard.writeText(user.id)
        toast.add({
          title: 'Copied to clipboard',
          description: 'User ID copied to clipboard'
        })
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Edit user',
      icon: 'i-lucide-pencil',
      disabled: isSelf,
      onSelect() {
        userToEdit.value = user
      }
    },
    {
      label: 'Reset password',
      icon: 'i-lucide-key',
      disabled: isSelf,
      onSelect() {
        userForPasswordReset.value = user
      }
    },
    {
      type: 'separator' as const
    },
    {
      label: 'Delete user',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      disabled: isSelf || user.role === 'ADMIN',
      onSelect() {
        userToDelete.value = user
        deleteModalOpen.value = true
      }
    }
  ]
}

// Define table columns
const columns: TableColumn<User>[] = [
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
    cell: ({ row }) => h('span', { class: 'text-sm text-muted font-mono' }, row.original.id.slice(0, 8))
  },
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) => {
      const user = row.original
      return h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted' }, user.name),
        h('p', { class: 'text-sm text-muted' }, user.email)
      ])
    }
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()

      return h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label: 'Email',
        icon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
      })
    }
  },
  {
    accessorKey: 'role',
    header: 'Role',
    filterFn: 'equals',
    cell: ({ row }) => {
      const user = row.original
      const isSelf = user.id === currentUser.value?.id

      return h(USelect, {
        'modelValue': user.role,
        'items': ['ADMIN', 'STANDARD'],
        'color': 'neutral',
        'disabled': isSelf,
        'ui': { value: 'capitalize', item: 'capitalize' },
        'onUpdate:modelValue': (newRole: string) => {
          if (newRole !== user.role) {
            selectedUser.value = { ...user, role: newRole as 'ADMIN' | 'STANDARD' }
          }
        }
      })
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
    header: 'Joined',
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

// Role filter
const roleFilter = ref('all')

watch(() => roleFilter.value, (newVal) => {
  if (!table?.value?.tableApi) return

  const roleColumn = table.value.tableApi.getColumn('role')
  if (!roleColumn) return

  if (newVal === 'all') {
    roleColumn.setFilterValue(undefined)
  } else {
    roleColumn.setFilterValue(newVal)
  }
})

// Pagination
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

// Get selected users for bulk actions
const selectedUsers = computed<User[]>(() => {
  if (!table.value?.tableApi || !data.value) return []
  return table.value.tableApi.getFilteredSelectedRowModel().rows.map((row: { original: User }) => row.original)
})
</script>

<template>
  <UDashboardPanel id="users">
    <template #header>
      <UDashboardNavbar title="User Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UsersAddModal @refresh="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5">
        <UInput
          :model-value="(table?.tableApi?.getColumn('email')?.getFilterValue() as string)"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Filter emails..."
          @update:model-value="table?.tableApi?.getColumn('email')?.setFilterValue($event)"
        />

        <div class="flex flex-wrap items-center gap-1.5">
          <!-- Bulk Delete Button (shows when rows are selected) -->
          <UsersDeleteModal
            :count="selectedUsers.length"
            :users="selectedUsers"
            @refresh="() => { refresh(); rowSelection = {} }"
          >
            <UButton
              v-if="selectedUsers.length > 0"
              label="Delete"
              color="error"
              variant="subtle"
              icon="i-lucide-trash"
            >
              <template #trailing>
                <UKbd>
                  {{ selectedUsers.length }}
                </UKbd>
              </template>
            </UButton>
          </UsersDeleteModal>

          <USelect
            v-model="roleFilter"
            :items="[
              { label: 'All', value: 'all' },
              { label: 'Admins', value: 'ADMIN' },
              { label: 'Standard', value: 'STANDARD' }
            ]"
            :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
            placeholder="Filter role"
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

      <!-- Edit User Modal -->
      <UsersEditModal :user="userToEdit" @refresh="() => { refresh(); userToEdit = null }" />

      <!-- Edit Role Modal (triggered when role dropdown changes) -->
      <UsersEditRoleModal :user="selectedUser" @refresh="() => { refresh(); selectedUser = null }" />

      <!-- Reset Password Modal -->
      <UsersResetPasswordModal :user="userForPasswordReset" @refresh="() => { refresh(); userForPasswordReset = null }" />

      <!-- Delete Single User Modal (from dropdown) -->
      <UModal
        v-model:open="deleteModalOpen"
        :title="`Delete ${userToDelete?.name || 'user'}`"
        :description="`Are you sure? This action cannot be undone.`"
      >
        <template #body>
          <div v-if="userToDelete" class="space-y-4">
            <!-- Admin Protection Warning -->
            <div v-if="userToDelete.role === 'ADMIN'" class="p-3 rounded-md bg-warning/10 border border-warning/20">
              <div class="flex gap-2">
                <UIcon name="i-lucide-shield-alert" class="text-warning shrink-0 mt-0.5" />
                <div class="text-sm text-warning">
                  <p class="font-medium mb-1">
                    Admin Account Protection
                  </p>
                  <p>
                    This user is an admin. Change their role to "Standard" first before you can delete their account.
                  </p>
                </div>
              </div>
            </div>

            <!-- Standard Deletion Warning -->
            <div v-else class="p-3 rounded-md bg-error/10 border border-error/20">
              <div class="flex gap-2">
                <UIcon name="i-lucide-info" class="text-error shrink-0 mt-0.5" />
                <div class="text-sm text-error">
                  <p class="font-medium mb-1">
                    What happens when you delete this user:
                  </p>
                  <ul class="list-disc list-inside space-y-1">
                    <li>User account will be permanently deleted</li>
                    <li>Their {{ userToDelete.bookingCount }} booking(s) will be preserved but unlinked</li>
                    <li>User will be logged out immediately</li>
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
              label="Delete User"
              color="error"
              :disabled="userToDelete?.role === 'ADMIN'"
              @click="deleteSingleUser"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
