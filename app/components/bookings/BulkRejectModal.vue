/**
 * Rejecting several bookings at once still requires a reason; it is shown to
 * every requester in the selection.
 */

<script setup lang="ts">
const props = defineProps<{
  count: number
}>()

const emit = defineEmits<{
  reject: [rejectionReason: string]
}>()

const toast = useToast()
const open = defineModel<boolean>('open', { default: false })
const rejectionReason = ref('')

watch(open, (isOpen) => {
  if (isOpen) rejectionReason.value = ''
})

function onSubmit() {
  if (!rejectionReason.value.trim()) {
    toast.add({
      title: 'Error',
      description: 'Rejection reason is required',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
    return
  }

  open.value = false
  emit('reject', rejectionReason.value)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reject Booking Requests"
    description="Please provide a reason for rejecting these booking requests"
  >
    <template #body>
      <div class="space-y-4">
        <div class="p-3 rounded-md bg-muted/50 border border-primary">
          <p class="text-sm text-muted">
            <span class="font-medium text-highlighted">{{ props.count }}</span>
            booking{{ props.count === 1 ? '' : 's' }} will be rejected, and every requester will be
            sent this reason.
          </p>
        </div>

        <UFormField
          label="Rejection Reason"
          required
          class="w-full"
        >
          <UTextarea
            v-model="rejectionReason"
            placeholder="e.g., No rooms available at the requested times..."
            :rows="4"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="() => { open = false }"
          />
          <UButton
            label="Reject Requests"
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
