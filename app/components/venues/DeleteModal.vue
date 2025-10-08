/**
 * Delete Venues Modal Component
 *
 * Modal for permanently deleting selected venue(s) with confirmation.
 *
 * Features:
 * - Bulk delete support (permanent deletion)
 * - Warning about permanent deletion
 * - Prevents deletion of venues with bookings
 * - Toast notifications for success/error
 *
 * @props count - Number of venues selected for deletion
 * @props venues - Array of venue objects to delete
 * @emits refresh - Emitted after successful deletion
 */
<script setup lang="ts">
interface Venue {
  id: number
  campus: string | null
  building: string
  roomName: string
  bookingCount: number
}

const props = withDefaults(defineProps<{
  count?: number
  venues?: Venue[]
}>(), {
  count: 0,
  venues: () => []
})

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const open = ref(false)
const isDeleting = ref(false)

const totalBookings = computed(() =>
  props.venues.reduce((sum, venue) => sum + venue.bookingCount, 0)
)

const hasBookings = computed(() =>
  props.venues.some(venue => venue.bookingCount > 0)
)

const canDelete = computed(() => !hasBookings.value)

async function onSubmit() {
  if (hasBookings.value) {
    toast.add({
      title: 'Cannot delete',
      description: 'Some venues have existing bookings',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
    return
  }

  isDeleting.value = true
  try {
    // Permanently delete all selected venues
    await Promise.all(
      props.venues.map(venue =>
        $fetch(`/api/venues/${venue.id}`, { method: 'DELETE' })
      )
    )

    toast.add({
      title: 'Venues deleted',
      description: `${props.count} venue${props.count > 1 ? 's' : ''} permanently deleted`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete venues',
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
    :title="`Delete ${count} venue${count > 1 ? 's' : ''}`"
    :description="hasBookings ? 'Cannot delete: Venues with bookings cannot be deleted' : `Are you sure? This action cannot be undone.`"
  >
    <slot @click="open = true" />

    <template #body>
      <!-- Venues with bookings warning -->
      <div v-if="hasBookings" class="mb-4 p-3 rounded-md bg-error/10 border border-error/20">
        <div class="flex gap-2">
          <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
          <div class="text-sm text-error">
            <p class="font-medium mb-1">
              Cannot Delete Venues with Bookings
            </p>
            <p>
              {{ totalBookings }} booking{{ totalBookings !== 1 ? 's' : '' }} exist across the selected venues.
              You must reassign or cancel these bookings first.
            </p>
          </div>
        </div>
      </div>

      <!-- Standard deletion warning -->
      <div v-else-if="count > 0" class="mb-4 p-3 rounded-md bg-error/10 border border-error/20">
        <div class="flex gap-2">
          <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
          <div class="text-sm text-error">
            <p class="font-medium mb-1">
              What happens when you delete {{ count > 1 ? 'these venues' : 'this venue' }}:
            </p>
            <ul class="list-disc list-inside space-y-1">
              <li>{{ count }} venue{{ count > 1 ? 's' : '' }} will be permanently deleted</li>
              <li>This action cannot be undone</li>
              <li>No bookings exist for {{ count > 1 ? 'these venues' : 'this venue' }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="open = false"
        />
        <UButton
          label="Delete"
          color="error"
          variant="solid"
          :disabled="!canDelete"
          :loading="isDeleting"
          @click="onSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
