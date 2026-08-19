<script setup lang="ts">
import { computed } from 'vue'

interface Conflict {
  id: number
}

interface Props {
  conflicts?: Conflict[]
  isAvailable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  conflicts: () => [],
  isAvailable: true
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
</script>

<template>
  <UBadge
    :color="badgeColor"
    variant="subtle"
    size="xs"
  >
    {{ badgeText }}
  </UBadge>
</template>
