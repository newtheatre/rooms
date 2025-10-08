/**
 * Add Room Modal Component
 *
 * Modal for creating new rooms (admin only).
 *
 * Features:
 * - Form validation with Zod schema
 * - Name, description, capacity, and active status
 * - Creates room via POST /api/rooms
 * - Toast notifications for success/error
 *
 * @emits refresh - Emitted after successful room creation
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const emit = defineEmits<{
  refresh: []
}>()

const schema = z.object({
  name: z.string().min(1, 'Room name is required').max(255),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive('Capacity must be a positive number').optional().nullable(),
  isActive: z.boolean()
})

const open = ref(false)
const isSubmitting = ref(false)

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: undefined,
  description: undefined,
  capacity: undefined,
  isActive: true
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true
  try {
    await $fetch('/api/rooms', {
      method: 'POST' as 'GET',
      body: event.data
    })

    toast.add({
      title: 'Room created',
      description: `${event.data.name} has been added`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    state.name = undefined
    state.description = undefined
    state.capacity = undefined
    state.isActive = true

    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create room',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New room" description="Add a new rehearsal room">
    <UButton label="New room" icon="i-lucide-plus" />

    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Room Name" placeholder="e.g., Studio A" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField label="Description (optional)" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Add details about the room..."
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <UFormField label="Capacity (optional)" name="capacity">
          <UInput
            v-model.number="state.capacity"
            type="number"
            placeholder="e.g., 20"
            class="w-full"
          />
          <template #description>
            Maximum number of people the room can accommodate
          </template>
        </UFormField>

        <UFormField label="Status" name="isActive">
          <UCheckbox v-model="state.isActive" label="Active (available for bookings)" />
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
