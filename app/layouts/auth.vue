<script setup lang="ts">
/**
 * Auth Layout
 *
 * Minimal layout for authentication pages (login, register).
 * No navigation, just centered content with branding.
 */
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Header with Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 mb-4 shadow-lg">
          <span class="text-2xl font-bold text-white">RB</span>
        </div>
        <h1 class="text-2xl font-bold text-default-900">
          Room Bookings
        </h1>
        <p class="text-sm text-default-500 mt-1">
          Rehearsal Space Management
        </p>
      </div>

      <!-- Main Content -->
      <slot />

      <!-- Footer -->
      <div class="mt-8 text-center text-sm text-default-500">
        <UColorModeButton
          size="sm"
          variant="ghost"
          color="neutral"
          class="mb-4"
        />
        <p>&copy; {{ new Date().getFullYear() }} Room Bookings. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>
