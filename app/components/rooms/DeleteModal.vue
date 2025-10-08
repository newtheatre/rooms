/**
 * Delete Rooms Modal Component
 *
 * Modal for permanently deleting selected room(s) with confirmation.
 *
 * Features:
 * - Bulk delete support (permanent deletion)
 * - Warning about permanent deletion
 * - Prevents deletion of rooms with bookings
 * - Toast notifications for success/error
 *
 * @props count - Number of rooms selected for deletion
 * @props rooms - Array of room objects to delete
 * @emits refresh - Emitted after successful deletion
 */
<script setup lang="ts">
interface Room {
  id: number
  name: string
  isActive: boolean
  bookingCount: number
}

const props = withDefaults(defineProps<{
  count?: number
  rooms?: Room[]
}>(), {
  count: 0,
  rooms: () => []
})

const emit = defineEmits<{
  refresh: []
}>()

const toast = useToast()
const open = ref(false)
const isDeleting = ref(false)

const totalBookings = computed(() =>
  props.rooms.reduce((sum, room) => sum + room.bookingCount, 0)
)

const hasBookings = computed(() =>
  props.rooms.some(room => room.bookingCount > 0)
)

const canDelete = computed(() => !hasBookings.value)

async function onSubmit() {
  if (hasBookings.value) {
    toast.add({
      title: 'Cannot delete',
      description: 'Some rooms have existing bookings',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
    return
  }

  isDeleting.value = true
  try {
    // Permanently delete all selected rooms
    await Promise.all(
      props.rooms.map(room =>
        $fetch(`/api/rooms/${room.id}?permanent=true`, { method: 'DELETE' })
      )
    )

    toast.add({
      title: 'Rooms deleted',
      description: `${props.count} room${props.count > 1 ? 's' : ''} permanently deleted`,
      icon: 'i-lucide-check',
      color: 'success'
    })

    open.value = false
    emit('refresh')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({
      title: 'Error',
      description: err.data?.message || 'Failed to delete rooms',
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
    :title="`Delete ${count} room${count > 1 ? 's' : ''}`"
    :description="hasBookings ? 'Cannot delete: Rooms with bookings cannot be deleted' : `Are you sure? This action cannot be undone.`"
  >
    <slot @click="open = true" />

    <template #body>
      <!-- Rooms with bookings warning -->
      <div v-if="hasBookings" class="mb-4 p-3 rounded-md bg-error/10 border border-error/20">
        <div class="flex gap-2">
          <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
          <div class="text-sm text-error">
            <p class="font-medium mb-1">
              Cannot Delete Rooms with Bookings
            </p>
            <p>
              {{ totalBookings }} booking{{ totalBookings !== 1 ? 's' : '' }} exist across the selected rooms.
              You must deactivate these rooms instead to preserve booking history.
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
              What happens when you delete {{ count > 1 ? 'these rooms' : 'this room' }}:
            </p>
            <ul class="list-disc list-inside space-y-1">
              <li>{{ count }} room{{ count > 1 ? 's' : '' }} will be permanently deleted</li>
              <li>This action cannot be undone</li>
              <li>No bookings exist for {{ count > 1 ? 'these rooms' : 'this room' }}</li>
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
