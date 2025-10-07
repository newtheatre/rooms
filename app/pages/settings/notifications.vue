/**
 * Notification Settings Page
 *
 * User notification preferences management.
 *
 * Features:
 * - Toggle notification channels (EMAIL, PUSH)
 * - Toggle booking update notifications
 * - Info about critical account updates (always sent via email)
 * - Web Push subscription management
 *
 * Data Loading:
 * - GET /api/account/preferences
 *
 * Data Updates:
 * - PUT /api/account/preferences
 * - POST /api/notifications/subscribe (for push)
 * - POST /api/notifications/unsubscribe
 *
 * @route /settings/notifications
 * @authenticated
 */
<script setup lang="ts">
const toast = useToast()

// Type for preferences response
interface PreferencesResponse {
  notificationChannels: string[]
  notificationPreferences: string[]
}

// Load preferences using useFetch (works with SSR and auth)
const { data: preferences, error } = await useFetch<PreferencesResponse>('/api/account/preferences')

// Show error toast if loading failed
if (error.value) {
  toast.add({
    title: 'Error',
    description: 'Failed to load notification preferences',
    icon: 'i-lucide-x-circle',
    color: 'error'
  })
}

// Notification state - populated from API response
const state = reactive<{ [key: string]: boolean }>({
  email: preferences.value?.notificationChannels.includes('EMAIL') ?? true,
  push: preferences.value?.notificationChannels.includes('PUSH') ?? false,
  booking_updates: preferences.value?.notificationPreferences.includes('BOOKING_UPDATES') ?? true
})

type NotificationField = {
  name: string
  label: string
  description: string
  disabled?: boolean
  value?: boolean
}

const sections: Array<{
  title: string
  description: string
  info?: boolean
  fields: NotificationField[]
}> = [{
  title: 'Notification channels',
  description: 'Where can we notify you?',
  fields: [{
    name: 'email',
    label: 'Email',
    description: 'Receive booking updates via email.'
  }, {
    name: 'push',
    label: 'Push notifications',
    description: 'Receive desktop/mobile push notifications.'
  }]
}, {
  title: 'Critical account updates',
  description: 'Important notifications that are always sent via email.',
  info: true,
  fields: [{
    name: 'critical',
    label: 'Security & account notifications',
    description: 'Password resets, security alerts, and critical account changes are always sent via email and cannot be disabled.',
    disabled: true,
    value: true
  }]
}, {
  title: 'Booking updates',
  description: 'Receive updates about your booking requests.',
  fields: [{
    name: 'booking_updates',
    label: 'Booking status changes',
    description: 'Get notified when your bookings are confirmed, rejected, or updated by an admin.'
  }]
}]

async function onChange(_fieldName: string) {
  try {
    const channels: string[] = []
    if (state.email) channels.push('EMAIL')
    if (state.push) channels.push('PUSH')

    const preferences: string[] = []
    if (state.booking_updates) preferences.push('BOOKING_UPDATES')

    await $fetch('/api/account/preferences', {
      method: 'PUT',
      body: {
        notificationChannels: channels,
        notificationPreferences: preferences
      }
    })

    toast.add({
      title: 'Preferences updated',
      description: 'Your notification settings have been saved.',
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error: unknown) {
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to update preferences',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}
</script>

<template>
  <div v-for="(section, index) in sections" :key="index">
    <UPageCard
      :title="section.title"
      :description="section.description"
      variant="naked"
      class="mb-4"
    />

    <UPageCard
      variant="subtle"
      :ui="{ container: 'divide-y divide-default' }"
      :class="{ 'bg-gradient-to-br from-primary/5 to-default': section.info }"
    >
      <UFormField
        v-for="field in section.fields"
        :key="field.name"
        :name="field.name"
        :label="field.label"
        :description="field.description"
        class="flex items-center justify-between not-last:pb-4 gap-2"
      >
        <USwitch
          v-if="!field.disabled"
          v-model="state[field.name]"
          @update:model-value="onChange(field.name)"
        />
        <USwitch
          v-else
          :model-value="field.value"
          disabled
        />
      </UFormField>
    </UPageCard>
  </div>
</template>
