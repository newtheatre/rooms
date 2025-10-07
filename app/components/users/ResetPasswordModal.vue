/**
 * Reset Password Modal Component
 *
 * Modal for resetting a user's password (admin only).
 *
 * Features:
 * - Generates a secure random password
 * - Copies password to clipboard automatically
 * - Toast notification with success message
 * - Confirmation before reset
 *
 * @props user - User object to reset password for
 * @emits refresh - Emitted after successful password reset
 */
<script setup lang="ts">
interface User {
  id: string
  name: string
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
const isResetting = ref(false)

const isSelf = computed(() =>
  props.user?.id === currentUser.value?.id
)

// Watch for user changes to open modal
watch(() => props.user, (newUser) => {
  if (newUser && !isSelf.value) {
    open.value = true
  }
}, { immediate: true })

function generatePassword() {
  // Generate a random password with uppercase, lowercase, numbers, and symbols
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function onSubmit() {
  if (!props.user) return

  isResetting.value = true
  try {
    const newPassword = generatePassword()

    await $fetch(`/api/users/${props.user.id}/password`, {
      method: 'PUT',
      body: { password: newPassword }
    })

    // Copy password to clipboard
    await navigator.clipboard.writeText(newPassword)

    toast.add({
      title: 'Password reset',
      description: `New password for ${props.user.name} has been copied to clipboard`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to reset password',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isResetting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reset Password"
    :description="isSelf ? 'Use settings to change your own password' : `Generate new password for ${user?.name}`"
  >
    <slot />

    <template #body>
      <div v-if="user && !isSelf" class="space-y-4">
        <div class="p-3 rounded-md bg-warning/10 border border-warning/20">
          <div class="flex gap-2">
            <UIcon name="i-lucide-info" class="text-warning shrink-0 mt-0.5" />
            <div class="text-sm text-warning">
              <p class="font-medium mb-1">
                A new password will be generated and copied to your clipboard
              </p>
              <ul class="list-disc list-inside space-y-1">
                <li>The password will be 16 characters long</li>
                <li>The user will need to be notified of their new password</li>
                <li>They can change it in their settings</li>
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
          @click="open = false"
        />
        <UButton
          label="Generate & Copy Password"
          icon="i-lucide-key"
          :disabled="isSelf"
          :loading="isResetting"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
