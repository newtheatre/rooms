/**
 * Add Venue Modal Component
 *
 * Modal for creating new external venues (admin only).
 *
 * Features:
 * - Form validation with Zod schema
 * - Campus, building, room name, and contact details
 * - Creates venue via POST /api/venues
 * - Toast notifications for success/error
 *
 * @emits refresh - Emitted after successful venue creation
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const emit = defineEmits<{
  refresh: []
}>()

const schema = z.object({
  campus: z.string().max(255).optional().nullable(),
  building: z.string().min(1, 'Building is required').max(255),
  roomName: z.string().min(1, 'Room name is required').max(255),
  contactDetails: z.string().max(500).optional().nullable()
})

const open = ref(false)
const isSubmitting = ref(false)

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  campus: undefined,
  building: undefined,
  roomName: undefined,
  contactDetails: undefined
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true
  try {
    await $fetch('/api/venues', {
      method: 'POST' as 'GET',
      body: event.data
    })

    toast.add({
      title: 'Venue created',
      description: `${event.data.building} - ${event.data.roomName} has been added`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    state.campus = undefined
    state.building = undefined
    state.roomName = undefined
    state.contactDetails = undefined

    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create venue',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New venue" description="Add a new external venue">
    <UButton label="New venue" icon="i-lucide-plus" />

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Campus (optional)" placeholder="e.g., North Campus" name="campus">
          <UInput v-model="state.campus" class="w-full" />
        </UFormField>

        <UFormField label="Building" placeholder="e.g., Arts Building" name="building">
          <UInput v-model="state.building" class="w-full" />
        </UFormField>

        <UFormField label="Room Name" placeholder="e.g., Room 201" name="roomName">
          <UInput v-model="state.roomName" class="w-full" />
        </UFormField>

        <UFormField label="Contact Details (optional)" name="contactDetails">
          <UTextarea
            v-model="state.contactDetails"
            placeholder="Contact person, phone, email, etc."
            class="w-full"
            :rows="3"
          />
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
