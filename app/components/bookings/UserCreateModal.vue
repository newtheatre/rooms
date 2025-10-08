<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import type { CalendarDate } from '@internationalized/date'
import { DateFormatter } from '@internationalized/date'

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'update:open', value: boolean): void
}>()

const toast = useToast()
const open = ref(false)
const isSubmitting = ref(false)

// Load available rooms
const { data: rooms, status: roomsStatus, refresh: refreshRooms } = useLazyFetch('/api/rooms', {
  query: { includeInactive: 'false' }
})
const { data: venues, status: venuesStatus, refresh: refreshVenues } = useLazyFetch('/api/venues')

watch(open, (isOpen) => {
  if (isOpen) {
    refreshRooms()
    refreshVenues()
  }
})

const roomItems = computed(() =>
  rooms.value?.map(r => ({
    id: `room-${r.id}`, // Prefix with 'room-' to avoid ID collision
    realId: r.id,
    label: r.name,
    description: `Capacity: ${r.capacity}${r.description ? ' • ' + r.description : ''}`,
    venueType: 'room' as const
  })) ?? []
)

const venueItems = computed(() =>
  venues.value?.map(v => ({
    id: `venue-${v.id}`, // Prefix with 'venue-' to avoid ID collision
    realId: v.id,
    label: `${v.building} - ${v.roomName}`,
    description: v.contactDetails || 'External venue',
    venueType: 'venue' as const
  })) ?? []
)

const allVenueOptions = computed(() => [
  ...roomItems.value,
  ...venueItems.value
])

const _venuesStatus = venuesStatus

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

const formSchema = z.object({
  eventTitle: z.string().min(1, 'Event title is required').max(255),
  numberOfAttendees: z.number().int().positive('Must be a positive number').optional().nullable(),
  eventDate: z.any().refine(val => val !== null && val !== undefined, 'Event date is required'),
  startTime: z.string().min(1, 'Start time is required').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  endTime: z.string().min(1, 'End time is required').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  roomId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional()
}).refine(
  (data) => {
    if (!data.startTime || !data.endTime) return true
    const [startHour = 0, startMin = 0] = data.startTime.split(':').map(Number)
    const [endHour = 0, endMin = 0] = data.endTime.split(':').map(Number)
    return (endHour * 60 + endMin) > (startHour * 60 + startMin)
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
)

type FormSchema = z.output<typeof formSchema>

const state = reactive({
  eventTitle: undefined as string | undefined,
  numberOfAttendees: undefined as number | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventDate: undefined as any,
  startTime: undefined as string | undefined,
  endTime: undefined as string | undefined,
  preferredVenueId: undefined as string | undefined, // Now a string like 'room-1' or 'venue-2'
  notes: undefined as string | undefined
})

const selectedVenue = computed(() => {
  if (!state.preferredVenueId) return undefined
  return allVenueOptions.value.find(v => v.id === state.preferredVenueId)
})

async function onSubmit(event: FormSubmitEvent<FormSchema>) {
  isSubmitting.value = true
  try {
    const eventDate = event.data.eventDate as CalendarDate

    // Build notes with venue preference if selected
    let notes = event.data.notes || ''
    if (selectedVenue.value) {
      const venueNote = `\n\nRequested ${selectedVenue.value.venueType === 'room' ? 'Room' : 'Venue'}: ${selectedVenue.value.label}`
      notes = notes.trim() + venueNote
    }

    const payload = {
      eventTitle: event.data.eventTitle,
      numberOfAttendees: event.data.numberOfAttendees || undefined,
      startTime: combineDateAndTime(eventDate, event.data.startTime),
      endTime: combineDateAndTime(eventDate, event.data.endTime),
      notes: notes.trim() || undefined
    }

    await $fetch('/api/bookings', {
      method: 'POST',
      body: payload
    })

    toast.add({
      title: 'Booking request submitted',
      description: 'Your booking request has been submitted and is pending review.',
      icon: 'i-lucide-check-circle',
      color: 'success'
    })

    // Reset form
    Object.assign(state, {
      eventTitle: undefined,
      numberOfAttendees: undefined,
      eventDate: undefined,
      startTime: undefined,
      endTime: undefined,
      preferredVenueId: undefined,
      notes: undefined
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to submit booking request',
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
    title="Request a Booking"
    description="Submit a booking request for review"
  >
    <slot :open="() => { emit('update:open', true) }">
      <UButton
        label="New Booking"
        icon="i-lucide-plus"
        size="lg"
        @click="emit('update:open', true)"
      />
    </slot>

    <template #body>
      <UForm
        :schema="formSchema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Event Information
          </h3>
          <div class="space-y-4">
            <UFormField
              label="Event Title"
              description="What is this booking for?"
              name="eventTitle"
              required
              class="w-full"
            >
              <UInput
                v-model="state.eventTitle"
                placeholder="e.g., Team Meeting, Workshop, Rehearsal"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Number of Attendees"
              description="How many people will attend?"
              name="numberOfAttendees"
              class="w-full"
            >
              <UInputNumber
                v-model="state.numberOfAttendees"
                :min="1"
                placeholder="e.g., 10"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Date & Time
          </h3>
          <div class="space-y-4">
            <UFormField
              label="Event Date"
              description="When is your event?"
              name="eventDate"
              required
              class="w-full"
            >
              <UPopover class="w-full">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  class="w-full justify-start"
                  size="lg"
                >
                  {{ state.eventDate ? df.format((state.eventDate as CalendarDate).toDate('UTC')) : 'Select a date' }}
                </UButton>

                <template #content>
                  <UCalendar
                    v-model="state.eventDate"
                    class="p-2"
                  />
                </template>
              </UPopover>
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField
                label="Start Time"
                name="startTime"
                required
                class="w-full"
              >
                <UInput
                  v-model="state.startTime"
                  type="time"
                  placeholder="09:00"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="End Time"
                name="endTime"
                required
                class="w-full"
              >
                <UInput
                  v-model="state.endTime"
                  type="time"
                  placeholder="17:00"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Venue Preference
          </h3>
          <UFormField
            label="Preferred Room or Venue"
            description="Select a room or external venue if you have a preference (optional)"
            name="preferredVenue"
            class="w-full"
          >
            <USelectMenu
              v-model="state.preferredVenueId"
              :items="allVenueOptions"
              value-key="id"
              :loading="roomsStatus === 'pending' || _venuesStatus === 'pending'"
              placeholder="No preference"
              :search-input="{ placeholder: 'Search rooms and venues...' }"
              class="w-full"
            >
              <template #item-label="{ item }">
                <div class="flex flex-col">
                  <span class="font-medium">{{ (item as any).label }}</span>
                  <span class="text-xs text-gray-500">{{ (item as any).description }}</span>
                </div>
              </template>
            </USelectMenu>
          </UFormField>

          <UAlert
            v-if="!selectedVenue"
            icon="i-lucide-info"
            color="neutral"
            variant="subtle"
            title="No venue selected"
            description="An administrator will assign a suitable room or venue to your booking."
            class="mt-3"
          />
          <UAlert
            v-else
            icon="i-lucide-info"
            color="info"
            variant="subtle"
            :title="`Preference: ${selectedVenue.label}`"
            description="This will be added to your booking notes for the administrator to consider."
            class="mt-3"
          />
        </div>

        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Additional Information
          </h3>
          <UFormField
            label="Notes"
            description="Any special requirements or additional details"
            name="notes"
            class="w-full"
          >
            <UTextarea
              v-model="state.notes"
              placeholder="e.g., Need AV equipment, wheelchair accessible, etc."
              :rows="4"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Submit Request"
            type="submit"
            icon="i-lucide-send"
            :loading="isSubmitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
