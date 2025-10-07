/**
 * Main Dashboard Page
 *
 * Primary landing page after login showing calendar view of all bookings.
 *
 * Features:
 * - Full calendar view with all bookings
 * - Color-coded by status (PENDING, CONFIRMED, AWAITING_EXTERNAL, etc.)
 * - Filter by room, status, date range
 * - Click event to view booking details
 * - Quick action: Create new booking (button)
 * - Admin: See all bookings
 * - Users: See own bookings highlighted
 *
 * Data Loading:
 * - GET /api/bookings (with filters)
 * - GET /api/rooms (for filter dropdown)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 * - Show different UI based on user.role (ADMIN vs STANDARD)
 *
 * @route /
 * @authenticated
 */
<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5" />
    </template>
  </UDashboardPanel>
</template>
