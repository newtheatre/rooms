/**
 * Edit Room Modal Component
 *
 * Modal for editing room details (admin only).
 *
 * Features:
 * - Edit name, description, capacity, and active status
 * - Form validation with Zod schema
 * - Toast notifications for success/error
 *
 * @props room - Room object to edit
 * @emits refresh - Emitted after successful update
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface Room {
  id: number
  name: string
  description: string | null
  capacity: number | null
  isActive: boolean
}

const props = defineProps<{
  room: Room | null
}>()

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const open = ref(false)
const isSubmitting = ref(false)

const schema = z.object({
  name: z.string().min(1, 'Room name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
  capacity: z.number().int().positive('Capacity must be a positive number').optional().nullable(),
  isActive: z.boolean()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: undefined,
  description: undefined,
  capacity: undefined,
  isActive: true
})

// Watch for room changes to open modal and populate form
watch(() => props.room, (newRoom) => {
  if (newRoom) {
    state.name = newRoom.name
    state.description = newRoom.description || undefined
    state.capacity = newRoom.capacity || undefined
    state.isActive = newRoom.isActive
    open.value = true
  }
}, { immediate: true })

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.room) return

  isSubmitting.value = true
  try {
    await $fetch(`/api/rooms/${props.room.id}`, {
      method: 'PUT',
      body: event.data
    })

    toast.add({
      title: 'Room updated',
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
      description: err.data?.message || 'Failed to update room',
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
    title="Edit Room"
    :description="`Edit details for ${room?.name}`"
  >
    <slot />

    <template #body>
      <UForm
        v-if="room"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Room Name" placeholder="e.g., Studio A" name="name">
          <UInput v-model="state.name" class="w-full" />
        </UFormField>

        <UFormField label="Description" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Add details about the room..."
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <UFormField label="Capacity" name="capacity">
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
            label="Save Changes"
            type="submit"
            :loading="isSubmitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
