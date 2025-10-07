/**
 * Edit User Modal Component
 *
 * Modal for editing user details (admin only).
 *
 * Features:
 * - Edit name and email
 * - Form validation with Zod schema
 * - Email uniqueness check
 * - Cannot edit own account (use settings)
 * - Toast notifications for success/error
 *
 * @props user - User object to edit
 * @emits refresh - Emitted after successful update
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface User {
  id: string
  name: string
  email: string
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
const isSubmitting = ref(false)

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: undefined,
  email: undefined
})

const isSelf = computed(() =>
  props.user?.id === currentUser.value?.id
)

// Watch for user changes to open modal and populate form
watch(() => props.user, (newUser) => {
  if (newUser && !isSelf.value) {
    state.name = newUser.name
    state.email = newUser.email
    open.value = true
  }
}, { immediate: true })

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.user) return

  isSubmitting.value = true
  try {
    await $fetch(`/api/users/${props.user.id}`, {
      method: 'PUT',
      body: event.data
    })

    toast.add({
      title: 'User updated',
      description: `${event.data.name} has been updated`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to update user',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit User"
    :description="isSelf ? 'Use settings to edit your own account' : `Edit details for ${user?.name}`"
  >
    <slot />

    <template #body>
      <UForm
        v-if="user && !isSelf"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Name" placeholder="John Doe" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField label="Email" placeholder="john.doe@example.com" name="email">
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Save Changes"
            type="submit"
            :loading="isSubmitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
