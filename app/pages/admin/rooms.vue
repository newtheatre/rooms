/**
 * Admin: Manage Rooms Page
  *
  * Administrative interface for managing internal rooms.
  *
 */
<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})
</script>

<template>
  <UDashboardPanel id="rooms">
    <template #header>
      <UDashboardNavbar title="Room Management">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <!-- Add Button -->
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5" />
    </template>
  </UDashboardPanel>
</template>
