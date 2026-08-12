<script setup lang="ts">
/**
 * Add User Modal — stage-door integration.
 *
 * Creates (or matches) a central shadow account by email via the auth
 * service and mirrors it locally, so a booking can be attached to someone
 * who has never logged in. No passwords are generated — the person can
 * claim the account themselves later. Full identity management lives at
 * the auth service admin.
 */
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const emit = defineEmits<{ refresh: [] }>()

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Valid email is required')
})

type Schema = z.output<typeof schema>

const open = ref(false)
const submitting = ref(false)
const state = reactive<Partial<Schema>>({ name: '', email: '' })
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitting.value = true
  try {
    const result = await $fetch<{ existing: boolean }>('/api/users', {
      method: 'POST',
      body: event.data
    })
    toast.add({
      title: result.existing ? 'Existing NNT account linked' : 'User created',
      description: result.existing
        ? 'That email already has an NNT account — bookings will attach to it.'
        : 'They can claim the account later with "forgot password" on the NNT login page.',
      color: 'success'
    })
    open.value = false
    state.name = ''
    state.email = ''
    emit('refresh')
  } catch (error) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: err.data?.message || 'Could not create user', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Add user"
    description="Creates an NNT account they can claim later — no passwords to hand out."
  >
    <UButton
      icon="i-lucide-user-round-plus"
      label="Add user"
    />

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Name"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Email"
          name="email"
          required
        >
          <UInput
            v-model="state.email"
            type="email"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="submitting"
          class="self-end"
        >
          Add user
        </UButton>
      </UForm>
    </template>
  </UModal>
</template>
