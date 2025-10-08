/**
 * Delete Booking Modal
 *
 * Modal for confirming booking deletion.
 *
 * @props booking - Booking object to delete
 * @emits refresh - Emitted after successful deletion
 */
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
  refresh: []
}>()

const toast = useToast()
const open = ref(false)
const isDeleting = ref(false)

// Watch for booking changes to open modal
watch(() => props.booking, (newBooking) => {
  if (newBooking) {
    open.value = true
  }
}, { immediate: true })

const getStatusColor = (status: Booking['status']) => {
  switch (status) {
    case 'PENDING': return 'warning'
    case 'CONFIRMED': return 'success'
    case 'AWAITING_EXTERNAL': return 'info'
    case 'REJECTED': return 'error'
    case 'CANCELLED': return 'neutral'
    default: return 'neutral'
  }
}

const getStatusLabel = (status: Booking['status']) => {
  switch (status) {
    case 'PENDING': return 'Pending'
    case 'CONFIRMED': return 'Confirmed'
    case 'AWAITING_EXTERNAL': return 'Awaiting External'
    case 'REJECTED': return 'Rejected'
    case 'CANCELLED': return 'Cancelled'
    default: return status
  }
}

async function onSubmit() {
  if (!props.booking) return

  isDeleting.value = true
  try {
    await $fetch(`/api/bookings/${props.booking.id}`, { method: 'DELETE' })

    toast.add({
      title: 'Booking deleted',
      description: `${props.booking.eventTitle} has been deleted`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete booking',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
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
              :color="getStatusColor(booking.status)"
              :label="getStatusLabel(booking.status)"
              variant="subtle"
            />
          </p>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Delete Booking"
            color="error"
            variant="solid"
            :loading="isDeleting"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
