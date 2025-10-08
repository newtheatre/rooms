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

const { user } = useUserSession()
const showBookingModal = ref(false)
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <BookingsUserCreateModal />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Welcome Message -->
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {{ user?.name }}!
          </h2>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            Here's an overview of your bookings
          </p>
        </div>

        <!-- Stats -->
        <UserBookingStats />

        <!-- Quick Actions -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Quick Actions
            </h3>
          </template>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <NuxtLink to="/requests">
              <UCard
                class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-4">
                  <div class="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <UIcon
                      name="i-lucide-list"
                      class="w-6 h-6 text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      My Requests
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      View all your bookings
                    </p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>

            <BookingsUserCreateModal v-model:open="showBookingModal">
              <template #default>
                <UCard
                  class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-4">
                    <div class="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <UIcon
                        name="i-lucide-plus"
                        class="w-6 h-6 text-green-600 dark:text-green-400"
                      />
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">
                        New Booking
                      </p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        Request a new booking
                      </p>
                    </div>
                  </div>
                </UCard>
              </template>
            </BookingsUserCreateModal>

            <NuxtLink to="/settings">
              <UCard
                class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-4">
                  <div class="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                    <UIcon
                      name="i-lucide-settings"
                      class="w-6 h-6 text-purple-600 dark:text-purple-400"
                    />
                  </div>
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">
                      Settings
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      Manage your account
                    </p>
                  </div>
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </UCard>

        <!-- Calendar Placeholder -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Calendar
            </h3>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <USkeleton class="h-8 w-48" />
              <div class="flex gap-2">
                <USkeleton class="h-8 w-24" />
                <USkeleton class="h-8 w-24" />
              </div>
            </div>

            <div class="grid grid-cols-7 gap-2">
              <USkeleton
                v-for="i in 7"
                :key="`day-${i}`"
                class="h-8 w-full"
              />
            </div>

            <div class="grid grid-cols-7 gap-2">
              <USkeleton
                v-for="i in 35"
                :key="`date-${i}`"
                class="h-20 w-full"
              />
            </div>

            <div class="text-center py-4">
              <UIcon
                name="i-lucide-calendar-clock"
                class="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2"
              />
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Interactive calendar view coming soon
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
