<script setup lang="ts">
interface MinimalBooking {
  id: number
  eventTitle: string
  status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
  parentBookingId: number | null
  occurrenceNumber: number | null
}

interface Props {
  booking: MinimalBooking | null
  action: 'assignRoom' | 'assignVenue' | 'initiateExternal' | 'reject' | 'delete' | null
  roomName?: string
  venueName?: string
  relatedBookings: MinimalBooking[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'confirm', applyToSeries: boolean, eligibleBookings: MinimalBooking[]): void
  (e: 'cancel'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const applyToSeries = ref(true)

const actionLabel = computed(() => {
  switch (props.action) {
    case 'assignRoom':
      return `Assign room "${props.roomName}"`
    case 'assignVenue':
      return `Assign venue "${props.venueName}"`
    case 'initiateExternal':
      return 'Initiate external booking'
    case 'reject':
      return 'Reject booking'
    case 'delete':
      return 'Delete booking'
    default:
      return 'Apply action'
  }
})

const eligibleBookings = computed(() => {
  if (!props.relatedBookings) return []

  switch (props.action) {
    case 'assignRoom':
      return props.relatedBookings.filter(b =>
        b.status === 'PENDING' || b.status === 'AWAITING_EXTERNAL'
      )
    case 'assignVenue':
      return props.relatedBookings.filter(b =>
        b.status === 'AWAITING_EXTERNAL'
      )
    case 'initiateExternal':
      return props.relatedBookings.filter(b =>
        b.status === 'PENDING'
      )
    case 'reject':
      return props.relatedBookings.filter(b =>
        b.status === 'PENDING' || b.status === 'AWAITING_EXTERNAL'
      )
    case 'delete':
      // All bookings can be deleted
      return props.relatedBookings
    default:
      return []
  }
})

function handleConfirm() {
  emit('confirm', applyToSeries.value, eligibleBookings.value)
  open.value = false
  applyToSeries.value = true // Reset for next time
}

function handleCancel() {
  emit('cancel')
  open.value = false
  applyToSeries.value = true // Reset for next time
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Recurring Event Detected"
    description="This booking is part of a recurring series"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          icon="i-lucide-repeat"
          color="info"
          variant="subtle"
          title="This is part of a recurring series"
          :description="`This booking is part of a series with ${relatedBookings.length} other occurrence(s).`"
        />

        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {{ actionLabel }}
          </p>
        </div>

        <div v-if="eligibleBookings.length > 0" class="space-y-3">
          <UCheckbox
            v-model="applyToSeries"
            label="Apply to all eligible bookings in this series"
          />

          <UAlert
            v-if="applyToSeries"
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
            :title="`Will affect ${eligibleBookings.length + 1} booking(s)`"
            :description="`The action will be applied to this booking plus ${eligibleBookings.length} other eligible booking(s) in the series.`"
          />

          <UAlert
            v-else
            icon="i-lucide-info"
            color="neutral"
            variant="subtle"
            title="Will affect 1 booking only"
            description="The action will only be applied to this specific booking."
          />

          <div v-if="applyToSeries && eligibleBookings.length > 0" class="mt-3">
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Eligible bookings in series:
            </p>
            <div class="max-h-40 overflow-y-auto space-y-1">
              <div
                v-for="relatedBooking in eligibleBookings"
                :key="relatedBooking.id"
                class="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"
              >
                <UIcon name="i-lucide-circle-dot" class="w-3 h-3" />
                <span>Occurrence #{{ relatedBooking.occurrenceNumber }} - {{ relatedBooking.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <UAlert
          v-else
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="No other eligible bookings"
          description="No other bookings in this series are eligible for this action."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="handleCancel"
        />
        <UButton
          :label="applyToSeries && eligibleBookings.length > 0 ? `Apply to ${eligibleBookings.length + 1} Booking(s)` : 'Apply to This Booking'"
          color="primary"
          icon="i-lucide-check"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
