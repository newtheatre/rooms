/**
 * Room Detail Calendar Page
 *
 * Calendar view filtered to show bookings for a specific internal room.
 *
 * Features:
 * - Calendar view for single room
 * - Room information header (name, description, capacity)
 * - All bookings for this room (color-coded by status)
 * - Quick action: Book this room
 * - Availability indicator
 *
 * Data Loading:
 * - GET /api/rooms/:id
 * - GET /api/bookings?roomId=:id
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to check authentication
 * - Redirect to /login if not authenticated
 *
 * @route /rooms/[id]
 * @authenticated
 */
<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})
</script>
