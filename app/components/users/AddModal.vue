<script setup lang="ts">
/**
 * Creates or matches a central shadow account by email, then mirrors it, so a
 * booking can attach to someone who has never signed in. No password is set.
 */
import * as z from 'zod'
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
const showError = useErrorToast()

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
        ? 'That email already has an NNT account; bookings will attach to it.'
        : 'They can claim the account later with "forgot password" on the NNT login page.',
      color: 'success'
    })
    open.value = false
    state.name = ''
    state.email = ''
    emit('refresh')
  } catch (error) {
    showError(error, 'Could not create user')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Add user"
    description="Creates an NNT account they can claim later; no passwords to hand out."
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
