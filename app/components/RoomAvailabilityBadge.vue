<script setup lang="ts">
import { computed } from 'vue'

interface Conflict {
  id: number
  eventTitle: string
  startTime: string
  endTime: string
  status: string
}

interface Props {
  conflicts?: Conflict[]
  isAvailable?: boolean
  showDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  conflicts: () => [],
  isAvailable: true,
  showDetails: false
})

const conflictCount = computed(() => props.conflicts?.length || 0)
const hasConflicts = computed(() => conflictCount.value > 0)

const badgeText = computed(() => {
  if (props.isAvailable && !hasConflicts.value) {
    return 'Available'
  }

  if (conflictCount.value === 1) {
    return '1 conflict'
  }

  return `${conflictCount.value} conflicts`
})

const badgeColor = computed(() => {
  if (props.isAvailable && !hasConflicts.value) {
    return 'success'
  }
  return 'warning'
})

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <UBadge
      :color="badgeColor"
      variant="subtle"
      size="xs"
    >
      {{ badgeText }}
    </UBadge>

    <UPopover
      v-if="showDetails && hasConflicts"
      class="inline-block"
    >
      <UButton
        icon="i-lucide-info"
        variant="ghost"
        size="xs"
        color="neutral"
      />

      <template #content>
        <div class="p-3 max-w-sm">
          <h4 class="font-semibold text-sm mb-2">
            Conflicting Bookings
          </h4>
          <ul class="space-y-2">
            <li
              v-for="conflict in conflicts"
              :key="conflict.id"
              class="text-xs"
            >
              <div class="font-medium">
                {{ conflict.eventTitle }}
              </div>
              <div class="text-muted">
                {{ formatDateTime(conflict.startTime) }} - {{ formatDateTime(conflict.endTime) }}
              </div>
              <UBadge
                :color="conflict.status === 'CONFIRMED' ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
                class="mt-1"
              >
                {{ conflict.status }}
              </UBadge>
            </li>
          </ul>
        </div>
      </template>
    </UPopover>
  </div>
</template>
