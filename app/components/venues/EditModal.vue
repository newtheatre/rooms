/**
 * Edit Venue Modal Component
 *
 * Modal for editing external venue details (admin only).
 *
 * Features:
 * - Edit campus, building, room name, and contact details
 * - Form validation with Zod schema
 * - Toast notifications for success/error
 *
 * @props venue - Venue object to edit
 * @emits refresh - Emitted after successful update
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface Venue {
  id: number
  campus: string | null
  building: string
  roomName: string
  contactDetails: string | null
}

const props = defineProps<{
  venue: Venue | null
}>()

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const open = ref(false)
const isSubmitting = ref(false)

const schema = z.object({
  campus: z.string().max(255).optional().nullable(),
  building: z.string().min(1, 'Building is required').max(255),
  roomName: z.string().min(1, 'Room name is required').max(255),
  contactDetails: z.string().max(500).optional().nullable()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  campus: undefined,
  building: undefined,
  roomName: undefined,
  contactDetails: undefined
})

// Watch for venue changes to open modal and populate form
watch(() => props.venue, (newVenue) => {
  if (newVenue) {
    state.campus = newVenue.campus || undefined
    state.building = newVenue.building
    state.roomName = newVenue.roomName
    state.contactDetails = newVenue.contactDetails || undefined
    open.value = true
  }
}, { immediate: true })

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.venue) return

  isSubmitting.value = true
  try {
    await $fetch(`/api/venues/${props.venue.id}`, {
      method: 'PUT',
      body: event.data
    })

    toast.add({
      title: 'Venue updated',
      description: `${event.data.building} - ${event.data.roomName} has been updated`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to update venue',
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
    title="Edit Venue"
    :description="`Edit details for ${venue?.building} - ${venue?.roomName}`"
  >
    <slot />

    <template #body>
      <UForm
        v-if="venue"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Campus" placeholder="e.g., North Campus" name="campus">
          <UInput v-model="state.campus" class="w-full" />
        </UFormField>

        <UFormField label="Building" placeholder="e.g., Arts Building" name="building">
          <UInput v-model="state.building" class="w-full" />
        </UFormField>

        <UFormField label="Room Name" placeholder="e.g., Room 201" name="roomName">
          <UInput v-model="state.roomName" class="w-full" />
        </UFormField>

        <UFormField label="Contact Details" name="contactDetails">
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
            label="Save Changes"
            type="submit"
            :loading="isSubmitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
