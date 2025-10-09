/**
 * Recurring Event Fields Component
 *
 * Reusable component for recurring event configuration.
 * Used in both user and admin booking creation modals.
 *
 * @props isRecurring - v-model for the recurring toggle
 * @props frequency - v-model for the frequency selection
 * @props daysOfWeek - v-model for the selected days (weekly only)
 * @props maxOccurrences - v-model for max number of occurrences
 * @props eventDate - Optional event date for preview
 * @props context - 'user' or 'admin' for different alert messages
 * @props dayNameFormat - 'full' or 'short' for day names
 */
<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'

interface Props {
  isRecurring: boolean
  frequency: 'DAILY' | 'WEEKLY' | 'CUSTOM'
  daysOfWeek: Array<'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'>
  maxOccurrences: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventDate?: any
  context?: 'user' | 'admin'
  dayNameFormat?: 'full' | 'short'
}

const props = withDefaults(defineProps<Props>(), {
  context: 'user',
  dayNameFormat: 'full'
})

const emit = defineEmits<{
  'update:isRecurring': [value: boolean]
  'update:frequency': [value: 'DAILY' | 'WEEKLY' | 'CUSTOM']
  'update:daysOfWeek': [value: Array<'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'>]
  'update:maxOccurrences': [value: number]
}>()

const isRecurringModel = computed({
  get: () => props.isRecurring,
  set: value => emit('update:isRecurring', value)
})

const frequencyModel = computed({
  get: () => props.frequency,
  set: value => emit('update:frequency', value)
})

const daysOfWeekModel = computed({
  get: () => props.daysOfWeek,
  set: value => emit('update:daysOfWeek', value)
})

const maxOccurrencesModel = computed({
  get: () => props.maxOccurrences,
  set: value => emit('update:maxOccurrences', value)
})

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' }
  // { value: 'CUSTOM', label: 'Custom Interval' } // Temporarily hidden
]

const weekDayOptions = computed(() => {
  if (props.dayNameFormat === 'short') {
    return [
      { value: 'SUN', label: 'Sun' },
      { value: 'MON', label: 'Mon' },
      { value: 'TUE', label: 'Tue' },
      { value: 'WED', label: 'Wed' },
      { value: 'THU', label: 'Thu' },
      { value: 'FRI', label: 'Fri' },
      { value: 'SAT', label: 'Sat' }
    ]
  }
  return [
    { value: 'MON', label: 'Monday' },
    { value: 'TUE', label: 'Tuesday' },
    { value: 'WED', label: 'Wednesday' },
    { value: 'THU', label: 'Thursday' },
    { value: 'FRI', label: 'Friday' },
    { value: 'SAT', label: 'Saturday' },
    { value: 'SUN', label: 'Sunday' }
  ]
})

const alertMessage = computed(() => {
  if (props.context === 'admin') {
    return {
      title: 'Creating Recurring Bookings',
      description: 'This will create multiple bookings with the specified pattern. All occurrences will have the same details.'
    }
  }
  return {
    title: 'Recurring Booking Request',
    description: 'Recurring bookings are subject to administrator approval and room availability for all dates.'
  }
})

const df = new DateFormatter('en-US', { dateStyle: 'medium' })
</script>

<template>
  <UCollapsible
    v-model:open="isRecurringModel"
    class="border border-gray-200 dark:border-gray-800 rounded-lg"
  >
    <div class="flex items-center justify-between w-full p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-repeat" class="w-4 h-4" />
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          Recurring Event
        </h3>
      </div>
      <div class="flex items-center gap-2" @click.stop>
        <span class="text-xs text-gray-500">{{ isRecurring ? 'Enabled' : 'Disabled' }}</span>
        <USwitch v-model="isRecurringModel" />
      </div>
    </div>

    <template #content>
      <div class="space-y-4 p-4 pt-0">
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          :title="alertMessage.title"
          :description="alertMessage.description"
        />

        <UFormField
          label="Frequency"
          description="How often should this event repeat?"
          name="recurringFrequency"
          required
          class="w-full"
        >
          <USelect
            v-model="frequencyModel"
            :items="frequencyOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="frequency === 'WEEKLY'"
          label="Days of Week"
          description="Select which days this event should occur"
          name="recurringDaysOfWeek"
          required
          class="w-full"
        >
          <UCheckboxGroup
            v-model="daysOfWeekModel"
            :items="weekDayOptions"
            value-key="value"
            label-key="label"
            orientation="horizontal"
          />
        </UFormField>

        <UFormField
          label="Number of Occurrences"
          description="How many times should this event repeat? (max 52)"
          name="recurringMaxOccurrences"
          required
          class="w-full"
        >
          <UInputNumber
            v-model="maxOccurrencesModel"
            :min="context === 'admin' ? 1 : 2"
            :max="52"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="maxOccurrences > 0"
          icon="i-lucide-calendar"
          color="neutral"
          variant="subtle"
        >
          <template #title>
            {{ context === 'admin' ? 'Will create' : 'Creating' }} {{ maxOccurrences }} occurrence{{ maxOccurrences > 1 ? 's' : '' }}
          </template>
          <template #description>
            <span v-if="frequency === 'DAILY'">
              <template v-if="context === 'admin' && eventDate">
                Every day for {{ maxOccurrences }} days starting from {{ df.format(eventDate.toDate('UTC')) }}
              </template>
              <template v-else>
                A booking will be created for {{ maxOccurrences }} consecutive days.
              </template>
            </span>
            <span v-else-if="frequency === 'WEEKLY' && daysOfWeek.length > 0">
              <template v-if="context === 'admin'">
                Every {{ daysOfWeek.map(d => weekDayOptions.find(w => w.value === d)?.label).join(', ') }} for {{ maxOccurrences }} weeks
              </template>
              <template v-else>
                Bookings will be created for {{ daysOfWeek.length }} day(s) each week for {{ Math.ceil(maxOccurrences / daysOfWeek.length) }} week(s).
              </template>
            </span>
            <span v-else-if="frequency === 'WEEKLY'">
              Select days of the week above
            </span>
            <span v-else>
              {{ maxOccurrences }} bookings will be created based on your selected pattern.
            </span>
          </template>
        </UAlert>
      </div>
    </template>
  </UCollapsible>
</template>
