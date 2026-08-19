<script setup lang="ts">
const UBadge = resolveComponent('UBadge')

interface Booking {
  id: number
  eventTitle: string
  status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
  user: {
    id: string
    name: string
    email: string
  } | null
}

const props = defineProps<{
  booking: Booking | null
}>()

const emit = defineEmits<{
  delete: [booking: Booking]
}>()

const open = ref(false)

// Watch for booking changes to open modal
watch(() => props.booking, (newBooking) => {
  if (newBooking) {
    open.value = true
  }
}, { immediate: true })

async function onSubmit() {
  if (!props.booking) return

  open.value = false
  emit('delete', props.booking)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Delete Booking"
    description="Are you sure you want to delete this booking?"
  >
    <template #body>
      <div class="space-y-4">
        <div class="p-3 rounded-md bg-error/10 border border-error/20">
          <div class="flex gap-2">
            <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
            <div class="text-sm text-error">
              <p class="font-medium mb-1">
                This action cannot be undone
              </p>
              <p>
                The booking will be permanently deleted from the system.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm">
            <span class="font-medium text-highlighted">Event:</span> {{ booking?.eventTitle }}
          </p>
          <p class="text-sm">
            <span class="font-medium text-highlighted">User:</span> {{ booking?.user?.name }}
          </p>
          <p class="text-sm flex items-center gap-2">
            <span class="font-medium text-highlighted">Status:</span>
            <component
              :is="UBadge"
              v-if="booking"
              :color="statusBadge(booking.status).color"
              :label="statusBadge(booking.status).label"
              variant="subtle"
            />
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="() => { open = false }"
          />
          <UButton
            label="Delete Booking"
            color="error"
            variant="solid"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
