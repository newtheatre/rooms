<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '#ui/types'
import type { CalendarDate } from '@internationalized/date'
import { DateFormatter } from '@internationalized/date'

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const toast = useToast()
const open = ref(false)
const isSubmitting = ref(false)

const { data: users, status: usersStatus, refresh: refreshUsers } = useLazyFetch('/api/users')
const { data: rooms, status: roomsStatus, refresh: refreshRooms } = useLazyFetch('/api/rooms', {
  query: { includeInactive: 'false' }
})
const { data: venues, status: venuesStatus, refresh: refreshVenues } = useLazyFetch('/api/venues')

watch(open, (isOpen) => {
  if (isOpen) {
    refreshUsers()
    refreshRooms()
    refreshVenues()
  }
})

const userItems = computed(() =>
  users.value?.map(u => ({
    id: u.id,
    label: u.name,
    description: u.email
  })) ?? []
)

const roomItems = computed(() =>
  rooms.value?.map(r => ({
    id: r.id,
    label: r.name
  })) ?? []
)

const venueItems = computed(() =>
  venues.value?.map(v => ({
    id: v.id,
    label: `${v.building} - ${v.roomName}`
  })) ?? []
)

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

const formSchema = z.object({
  userId: z.string().min(1, 'User is required'),
  eventTitle: z.string().min(1, 'Event title is required'),
  numberOfAttendees: z.number().int().positive('Must be a positive number').optional().nullable(),
  eventDate: z.any().refine(val => val !== null && val !== undefined, 'Event date is required'),
  startTime: z.string().min(1, 'Start time is required').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  endTime: z.string().min(1, 'End time is required').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  roomId: z.number().int().positive().optional().nullable(),
  externalVenueId: z.number().int().positive().optional().nullable(),
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
).refine(
  data => !(data.roomId && data.externalVenueId),
  {
    message: 'Cannot assign both an internal room and external venue',
    path: ['roomId']
  }
)

type FormSchema = z.output<typeof formSchema>

const state = reactive({
  userId: undefined as string | undefined,
  eventTitle: undefined as string | undefined,
  numberOfAttendees: undefined as number | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventDate: undefined as any,
  startTime: undefined as string | undefined,
  endTime: undefined as string | undefined,
  venueType: 'internal' as 'internal' | 'external' | undefined,
  roomId: undefined as number | undefined,
  externalVenueId: undefined as number | undefined,
  notes: undefined as string | undefined
})

const venueTypeOptions = [
  { value: 'internal', label: 'Internal Room' },
  { value: 'external', label: 'External Venue' }
]

const computedStatus = computed(() => {
  if (state.venueType === 'internal' && state.roomId) return 'CONFIRMED'
  if (state.venueType === 'external' && state.externalVenueId) return 'CONFIRMED'
  if (state.venueType === 'external' && !state.externalVenueId) return 'AWAITING_EXTERNAL'
  return 'PENDING'
})

// Clear room/venue selection when type changes
watch(() => state.venueType, (newType) => {
  if (newType === 'internal') {
    state.externalVenueId = undefined
  } else if (newType === 'external') {
    state.roomId = undefined
  } else {
    state.roomId = undefined
    state.externalVenueId = undefined
  }
})

async function onSubmit(event: FormSubmitEvent<FormSchema>) {
  isSubmitting.value = true
  try {
    const eventDate = event.data.eventDate as CalendarDate
    const payload = {
      userId: event.data.userId,
      eventTitle: event.data.eventTitle,
      numberOfAttendees: event.data.numberOfAttendees || undefined,
      startTime: combineDateAndTime(eventDate, event.data.startTime),
      endTime: combineDateAndTime(eventDate, event.data.endTime),
      roomId: event.data.roomId || undefined,
      externalVenueId: event.data.externalVenueId || undefined,
      notes: event.data.notes,
      status: computedStatus.value
    }

    await $fetch('/api/bookings', {
      method: 'POST',
      body: payload
    })

    toast.add({
      title: 'Booking created',
      description: `Successfully created booking for ${event.data.eventTitle}`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    Object.assign(state, {
      userId: undefined,
      eventTitle: undefined,
      numberOfAttendees: undefined,
      eventDate: undefined,
      startTime: undefined,
      endTime: undefined,
      venueType: 'internal',
      roomId: undefined,
      externalVenueId: undefined,
      notes: undefined
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to create booking',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

watch(() => state.roomId, (newVal) => {
  if (newVal) state.externalVenueId = undefined
})

watch(() => state.externalVenueId, (newVal) => {
  if (newVal) state.roomId = undefined
})
</script>

<template>
  <UModal
    v-model:open="open"
    title="Create Booking"
    description="Create a booking on behalf of a user"
  >
    <UButton label="Create Booking" icon="i-lucide-plus" />

    <template #body>
      <UForm
        :schema="formSchema"
        :state="state"
        class="space-y-6"
        @submit="onSubmit"
      >
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            User Information
          </h3>
          <UFormField
            label="User"
            description="Select the user this booking is for"
            name="userId"
            required
            class="w-full"
          >
            <USelectMenu
              v-model="state.userId"
              :items="userItems"
              value-key="id"
              :loading="usersStatus === 'pending'"
              placeholder="Select user..."
              :search-input="{ placeholder: 'Search users...' }"
              class="w-full"
            >
              <template #item-label="{ item }">
                <div class="flex flex-col">
                  <span>{{ item.label }}</span>
                  <span class="text-xs text-muted">{{ item.description }}</span>
                </div>
              </template>
            </USelectMenu>
          </UFormField>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Event Details
          </h3>
          <div class="space-y-4">
            <UFormField
              label="Event Title"
              name="eventTitle"
              required
              class="w-full"
            >
              <UInput
                v-model="state.eventTitle"
                placeholder="e.g., Team Meeting"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Number of Attendees"
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

            <UFormField
              label="Event Date"
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
                >
                  {{ state.eventDate ? df.format((state.eventDate as CalendarDate).toDate('UTC')) : 'Select a date' }}
                </UButton>

                <template #content>
                  <UCalendar v-model="state.eventDate" class="p-2" />
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

            <UFormField
              label="Notes"
              name="notes"
              class="w-full"
            >
              <UTextarea
                v-model="state.notes"
                placeholder="Any additional notes..."
                :rows="3"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Venue Assignment (Optional)
          </h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <UFormField
                label="Venue Type"
                description="Select venue type"
                name="venueType"
                class="w-full"
              >
                <USelect
                  v-model="state.venueType"
                  :items="venueTypeOptions"
                  value-key="value"
                  placeholder="No venue type selected"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-if="state.venueType === 'internal'"
                label="Select Room"
                description="Choose an internal room"
                name="roomId"
                class="w-full"
              >
                <USelectMenu
                  v-model="state.roomId"
                  :items="roomItems"
                  value-key="id"
                  :loading="roomsStatus === 'pending'"
                  placeholder="Select room..."
                  :search-input="{ placeholder: 'Search rooms...' }"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                v-else-if="state.venueType === 'external'"
                label="Select Venue"
                description="Choose an external venue"
                name="externalVenueId"
                class="w-full"
              >
                <USelectMenu
                  v-model="state.externalVenueId"
                  :items="venueItems"
                  value-key="id"
                  :loading="venuesStatus === 'pending'"
                  placeholder="Select venue (optional)"
                  :search-input="{ placeholder: 'Search venues...' }"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UAlert
              v-if="!state.venueType"
              icon="i-lucide-info"
              color="neutral"
              variant="subtle"
              title="Pending Status"
              description="Without a venue type selection, this booking will have PENDING status."
            />
            <UAlert
              v-else-if="state.venueType === 'internal' && state.roomId"
              icon="i-lucide-check-circle"
              color="success"
              variant="subtle"
              title="Confirmed"
              description="This booking will be created with CONFIRMED status."
            />
            <UAlert
              v-else-if="state.venueType === 'internal' && !state.roomId"
              icon="i-lucide-info"
              color="neutral"
              variant="subtle"
              title="Pending Status"
              description="Select a room to confirm this booking."
            />
            <UAlert
              v-else-if="state.venueType === 'external' && state.externalVenueId"
              icon="i-lucide-check-circle"
              color="success"
              variant="subtle"
              title="Confirmed"
              description="This booking will be created with CONFIRMED status."
            />
            <UAlert
              v-else-if="state.venueType === 'external' && !state.externalVenueId"
              icon="i-lucide-clock"
              color="warning"
              variant="subtle"
              title="Awaiting External Confirmation"
              description="This booking will be created with AWAITING_EXTERNAL status."
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Create Booking"
            type="submit"
            icon="i-lucide-check"
            :loading="isSubmitting"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
