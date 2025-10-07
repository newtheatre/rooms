<script setup lang="ts">
/**
 * AppLogo Component (Application Branding)
 *
 * Displays the application logo/name in the sidebar header.
 */

defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-3 px-3 py-2">
    <div class="size-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">
      RB
    </div>
    <div v-if="!collapsed" class="flex flex-col">
      <span class="text-sm font-semibold">Room Bookings</span>
      <span class="text-xs text-dimmed">Rehearsal Space</span>
    </div>
  </div>
</template>
