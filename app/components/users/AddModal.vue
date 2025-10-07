/**
 * Add User Modal Component
 *
 * Modal for creating new user accounts (admin only).
 *
 * Features:
 * - Form validation with Zod schema
 * - Name, email, and role selection
 * - Creates user via POST /api/users
 * - Toast notifications for success/error
 *
 * @emits refresh - Emitted after successful user creation
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const emit = defineEmits<{
  refresh: []
}>()

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'STANDARD']),
  password: z.string().min(8, 'Password must be at least 8 characters').optional()
})

const open = ref(false)
const isSubmitting = ref(false)
const generatedPassword = ref<string | null>(null)

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: undefined,
  email: undefined,
  role: 'STANDARD',
  password: undefined
})

const toast = useToast()

function generatePassword() {
  // Generate a random password with uppercase, lowercase, numbers, and symbols
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const password = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  state.password = password
  generatedPassword.value = password
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true
  try {
    const response = await $fetch<{ password?: string }>('/api/users', {
      method: 'POST' as 'GET',
      body: event.data
    })

    // Copy password to clipboard
    const passwordToCopy = event.data.password || response.password
    if (passwordToCopy) {
      await navigator.clipboard.writeText(passwordToCopy)
    }

    toast.add({
      title: 'User created',
      description: passwordToCopy
        ? `${event.data.name} has been added. Password copied to clipboard.`
        : `${event.data.name} has been added`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    state.name = undefined
    state.email = undefined
    state.role = 'STANDARD'
    state.password = undefined
    generatedPassword.value = null

    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create user',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New user" description="Add a new user account">
    <UButton label="New user" icon="i-lucide-plus" />

    <template #body>
      <UForm
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

        <UFormField label="Role" name="role">
          <USelect
            v-model="state.role"
            :items="[
              { label: 'Standard User', value: 'STANDARD' },
              { label: 'Administrator', value: 'ADMIN' }
            ]"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password (optional)" name="password">
          <div class="flex gap-2">
            <UInput
              v-model="state.password"
              type="text"
              placeholder="Leave blank to auto-generate"
              class="flex-1"
            />
            <UButton
              label="Generate"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              @click="generatePassword"
            />
          </div>
          <template #description>
            Leave blank to auto-generate a secure password
          </template>
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Create"
            type="submit"
            :loading="isSubmitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
