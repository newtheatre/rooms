/**
 * Admin: Manage External Venues Page
 *
 * Administrative interface for external venue management.
 *
 * Features:
 * - Table view of all external venues with selection
 * - Filter by campus
 * - Create new venues
 * - Update venue details (campus, building, room name, contact details)
 * - Delete venues (hard delete if no bookings exist)
 *
 * Data Loading:
 * - GET /api/venues
 *
 * Data Mutations:
 * - POST /api/venues (create venue)
 * - PUT /api/venues/:id (update venue)
 * - DELETE /api/venues/:id (hard delete)
 *
 * @route /admin/venues
 * @authenticated
 * @admin-only
 */
<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})
</script>

<template>
  <UDashboardPanel id="venues">
    <template #header>
      <UDashboardNavbar title="External Venue Management">
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
