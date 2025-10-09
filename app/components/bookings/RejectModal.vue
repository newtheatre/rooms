/**
 * Reject Booking Modal
 *
 * Modal for rejecting booking requests with a required reason.
 *
 * @props booking - Booking object to reject
 * @emits refresh - Emitted after successful rejection
 */
<script setup lang="ts">
interface Booking {
  id: number
  eventTitle: string
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
  reject: [booking: Booking, rejectionReason: string]
}>()

const toast = useToast()
const open = ref(false)
const rejectionReason = ref('')

// Watch for booking changes to open modal
watch(() => props.booking, (newBooking) => {
  if (newBooking) {
    rejectionReason.value = ''
    open.value = true
  }
}, { immediate: true })

async function onSubmit() {
  if (!props.booking || !rejectionReason.value.trim()) {
    toast.add({
      title: 'Error',
      description: 'Rejection reason is required',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
    return
  }

  open.value = false
  emit('reject', props.booking, rejectionReason.value)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reject Booking Request"
    description="Please provide a reason for rejecting this booking request"
  >
    <template #body>
      <div class="space-y-4">
        <div class="p-3 rounded-md bg-muted/50 border border-primary">
          <p class="text-sm text-muted mb-1">
            Event: <span class="font-medium text-highlighted">{{ booking?.eventTitle }}</span>
          </p>
          <p class="text-sm text-muted">
            Requested by: <span class="font-medium text-highlighted">{{ booking?.user?.name }}</span>
          </p>
        </div>

        <UFormField
          label="Rejection Reason"
          required
          class="w-full"
        >
          <UTextarea
            v-model="rejectionReason"
            placeholder="e.g., Room not available at requested time..."
            :rows="4"
            class="w-full"
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
            label="Reject Request"
            color="error"
            variant="solid"
            :disabled="!rejectionReason.trim()"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
