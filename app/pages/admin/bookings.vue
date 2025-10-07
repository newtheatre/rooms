/**
 * Admin: Manage Bookings Page
 *
 * Administrative interface for reviewing and managing all booking requests.
 *
 * Features:
 * - Table view of all bookings (all users)
 * - Filter by status, user, date range, room
 * - Tabs: Pending / All Bookings
 * - Pending bookings (priority view):
 *   - Assign to internal room → Status: CONFIRMED
 *   - Assign to external venue → Status: AWAITING_EXTERNAL
 *   - Reject with reason → Status: REJECTED
 * - Update booking status
 * - View user details for each booking
 * - Cancel any booking
 * - Booking details modal/panel
 * - Send notifications on status changes (respects user preferences)
 *
 * Data Loading:
 * - GET /api/bookings (all bookings for admin)
 * - GET /api/rooms (for assignment dropdown)
 * - GET /api/venues (for assignment dropdown)
 *
 * Data Mutations:
 * - PUT /api/bookings/:id (update status, assign room/venue, rejection reason)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 * - Redirect to / if user.role !== 'ADMIN' (403)
 *
 * @route /admin/bookings
 * @authenticated
 * @admin-only
 */
<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})
</script>

<template>
  <UDashboardPanel id="bookings">
    <template #header>
      <UDashboardNavbar title="Booking Management">
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
