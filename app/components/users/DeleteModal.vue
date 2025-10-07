/**
 * Delete Users Modal Component
 *
 * Modal for deleting selected user(s) with confirmation.
 *
 * Features:
 * - Bulk delete support
 * - Warning about booking preservation
 * - Prevents deletion if user is in selection
 * - Toast notifications for success/error
 *
 * @props count - Number of users selected for deletion
 * @props users - Array of user objects to delete
 * @emits refresh - Emitted after successful deletion
 */
<script setup lang="ts">
interface User {
  id: string
  name: string
  role: 'ADMIN' | 'STANDARD'
  bookingCount: number
}

const props = withDefaults(defineProps<{
  count?: number
  users?: User[]
}>(), {
  count: 0,
  users: () => []
})

const emit = defineEmits<{
  refresh: []
}>()

const { user: currentUser } = useUserSession()
const toast = useToast()
const open = ref(false)
const isDeleting = ref(false)

const totalBookings = computed(() =>
  props.users.reduce((sum, user) => sum + user.bookingCount, 0)
)

const hasSelf = computed(() =>
  props.users.some(user => user.id === currentUser.value?.id)
)

const hasAdmin = computed(() =>
  props.users.some(user => user.role === 'ADMIN')
)

const canDelete = computed(() => !hasSelf.value && !hasAdmin.value)

async function onSubmit() {
  if (hasSelf.value) {
    toast.add({
      title: 'Cannot delete',
      description: 'You cannot delete your own account',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
    return
  }

  if (hasAdmin.value) {
    toast.add({
      title: 'Cannot delete',
      description: 'Admin accounts cannot be deleted. Change their role to Standard first.',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
    return
  }

  isDeleting.value = true
  try {
    // Delete all selected users
    await Promise.all(
      props.users.map(user =>
        $fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      )
    )

    toast.add({
      title: 'Users deleted',
      description: `${props.count} user${props.count > 1 ? 's' : ''} deleted successfully`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete users',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Delete ${count} user${count > 1 ? 's' : ''}`"
    :description="hasSelf ? 'Cannot delete: Selection includes your own account' : hasAdmin ? 'Cannot delete: Selection includes admin accounts' : `Are you sure? This action cannot be undone.`"
  >
    <slot @click="open = true" />

    <template #body>
      <!-- Self-deletion warning -->
      <div v-if="hasSelf" class="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20">
        <div class="flex gap-2">
          <UIcon name="i-lucide-alert-triangle" class="text-warning shrink-0 mt-0.5" />
          <div class="text-sm text-warning">
            <p class="font-medium mb-1">
              Cannot Delete Your Own Account
            </p>
            <p>
              The selection includes your own account. Remove yourself from the selection to continue.
            </p>
          </div>
        </div>
      </div>

      <!-- Admin protection warning -->
      <div v-else-if="hasAdmin" class="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20">
        <div class="flex gap-2">
          <UIcon name="i-lucide-shield-alert" class="text-warning shrink-0 mt-0.5" />
          <div class="text-sm text-warning">
            <p class="font-medium mb-1">
              Admin Account Protection
            </p>
            <p>
              The selection includes admin accounts. Change their role to "Standard" first, or remove them from the selection.
            </p>
          </div>
        </div>
      </div>

      <!-- Standard deletion warning -->
      <div v-else-if="count > 0" class="mb-4 p-3 rounded-md bg-error/10 border border-error/20">
        <div class="flex gap-2">
          <UIcon name="i-lucide-info" class="text-error shrink-0 mt-0.5" />
          <div class="text-sm text-error">
            <p class="font-medium mb-1">
              What happens when you delete {{ count > 1 ? 'these users' : 'this user' }}:
            </p>
            <ul class="list-disc list-inside space-y-1">
              <li>{{ count }} user account{{ count > 1 ? 's' : '' }} will be permanently deleted</li>
              <li>Their {{ totalBookings }} booking{{ totalBookings !== 1 ? 's' : '' }} will be preserved but unlinked</li>
              <li>Deleted users will be logged out immediately</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          label="Delete"
          color="error"
          variant="solid"
          :disabled="!canDelete"
          :loading="isDeleting"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
