/**
 * Account Settings Page - Profile
 *
 * User profile management for the Rehearsal Room Booking System.
 *
 * Features:
 * - Update name and email
 * - Form validation with Zod
 * - Success/error feedback
 * - Email uniqueness validation
 *
 * Data Loading:
 * - GET /api/account/profile
 *
 * Data Updates:
 * - PUT /api/account/profile (name, email)
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() to get current user
 * - Redirect to /login if not authenticated
 *
 * @route /settings
 * @authenticated
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { user, fetch: refreshSession } = useUserSession()

const toast = useToast()

// Profile validation schema (from technical spec)
const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address')
})

type ProfileSchema = z.output<typeof profileSchema>

// Profile state - populated from user session
const profile = reactive<Partial<ProfileSchema>>({
  name: user.value?.name || '',
  email: user.value?.email || ''
})

const isSubmitting = ref(false)

// Submit profile updates
async function onSubmit(event: FormSubmitEvent<ProfileSchema>) {
  isSubmitting.value = true

  try {
    await $fetch('/api/account/profile', {
      method: 'PUT',
      body: event.data
    })

    // Refresh the session to get updated user data
    await refreshSession()

    toast.add({
      title: 'Success',
      description: 'Your profile has been updated.',
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error: unknown) {
    // Check if it's a 409 Conflict error (email already in use)
    let message = 'Failed to update profile'
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const fetchError = error as { statusCode: number }
      if (fetchError.statusCode === 409) {
        message = 'This email is already in use'
      }
    }

    toast.add({
      title: 'Error',
      description: message,
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UForm
    id="settings"
    :schema="profileSchema"
    :state="profile"
    @submit="onSubmit"
  >
    <UPageCard
      title="Profile"
      description="Your personal information for the room booking system."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="settings"
        label="Save changes"
        color="neutral"
        type="submit"
        :loading="isSubmitting"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField
        name="name"
        label="Name"
        description="Your full name as it will appear in booking requests."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.name"
          autocomplete="name"
          placeholder="Your name"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="email"
        label="Email"
        description="Used to sign in and receive booking notifications."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.email"
          type="email"
          autocomplete="email"
          placeholder="your.email@example.com"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="role"
        label="Role"
        description="Your current permission level in the system."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UBadge :color="user?.role === 'ADMIN' ? 'primary' : 'neutral'" variant="subtle">
          {{ user?.role || 'STANDARD' }}
        </UBadge>
      </UFormField>
    </UPageCard>
  </UForm>

  <UPageCard
    title="Account information"
    description="Your account details and membership information."
    variant="subtle"
  >
    <div class="flex flex-col gap-4">
      <div>
        <div class="text-sm font-medium text-default-500 mb-1">
          Account created
        </div>
        <div class="text-sm">
          <!-- TODO: Load from API and format with date-fns -->
          {{ new Date().toLocaleDateString() }}
        </div>
      </div>
      <div>
        <div class="text-sm font-medium text-default-500 mb-1">
          User ID
        </div>
        <div class="font-mono text-xs">
          {{ user?.id || 'Loading...' }}
        </div>
      </div>
    </div>
  </UPageCard>
</template>
