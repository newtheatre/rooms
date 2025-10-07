/**
 * User Booking Requests Page
 *
 * Lists all booking requests made by the current user.
 *
 * Features:
 * - Table/list view of user's bookings
 * - Status badges (PENDING, CONFIRMED, AWAITING_EXTERNAL, REJECTED, CANCELLED)
 * - Filter by status
 * - Sort by date (ascending/descending)
 * - Quick actions: View details, Cancel booking (if PENDING or CONFIRMED)
 * - Show rejection reason for REJECTED bookings
 * - Empty state with "Create booking" CTA
 *
 * Data Loading:
 * - GET /api/bookings (returns only user's bookings for STANDARD users)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 *
 * @route /requests
 * @authenticated
 */
<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})
</script>

<template>
  <UDashboardPanel id="requests">
    <template #header>
      <UDashboardNavbar title="My Requests">
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
