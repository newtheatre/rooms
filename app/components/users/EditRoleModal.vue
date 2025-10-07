/**
 * Edit User Role Modal Component
 *
 * Modal for changing a user's role between ADMIN and STANDARD.
 *
 * Features:
 * - Visual role transition display
 * - Warning for admin promotions
 * - Prevents self-role-change
 * - Toast notifications for success/error
 *
 * @props user - User object to edit
 * @emits refresh - Emitted after successful role update
 */
<script setup lang="ts">
interface User {
  id: string
  name: string
  role: 'ADMIN' | 'STANDARD'
}

const props = defineProps<{
  user: User | null
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { user: currentUser } = useUserSession()
const toast = useToast()
const open = ref(false)
const isUpdating = ref(false)

const newRole = computed(() =>
  props.user?.role === 'ADMIN' ? 'STANDARD' : 'ADMIN'
)

const isSelf = computed(() =>
  props.user?.id === currentUser.value?.id
)

// Watch for user changes to open modal
watch(() => props.user, (newUser) => {
  if (newUser && !isSelf.value) {
    open.value = true
  }
}, { immediate: true })

async function onSubmit() {
  if (!props.user || isSelf.value) return

  isUpdating.value = true
  try {
    await $fetch(`/api/users/${props.user.id}`, {
      method: 'PUT',
      body: {
        role: props.user.role // Use the new role from props (set by dropdown)
      }
    })

    toast.add({
      title: 'Role updated',
      description: `${props.user.name} is now ${props.user.role}`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to update role',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isUpdating.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Change User Role"
    :description="isSelf ? 'Cannot change your own role' : `Change role for ${user?.name}`"
  >
    <slot />

    <template #body>
      <div v-if="user && !isSelf" class="space-y-4">
        <div class="flex items-center gap-3">
          <UBadge :color="newRole === 'STANDARD' ? 'neutral' : 'primary'" variant="subtle">
            {{ newRole }}
          </UBadge>
          <UIcon name="i-lucide-arrow-right" class="text-muted" />
          <UBadge :color="user.role === 'ADMIN' ? 'primary' : 'neutral'" variant="subtle">
            {{ user.role }}
          </UBadge>
        </div>

        <div v-if="user.role === 'ADMIN'" class="p-3 rounded-md bg-warning/10 border border-warning/20">
          <div class="flex gap-2">
            <UIcon name="i-lucide-alert-triangle" class="text-warning shrink-0 mt-0.5" />
            <p class="text-sm text-warning">
              Admin users have full access to all system features including user management, room management, and all bookings.
            </p>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          label="Update Role"
          :disabled="isSelf"
          :loading="isUpdating"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
