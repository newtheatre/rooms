/**
 * Security Settings Page
 *
 * Password management and account security.
 *
 * Features:
 * - Change password with validation
 * - Password strength requirements
 * - Current password verification
 * - Account creation date display
 *
 * Data Updates:
 * - PUT /api/account/password
 *
 * @route /settings/security
 * @authenticated
 */
<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { H3Error } from 'h3'

const { user, fetch: refreshSession } = useUserSession()
const toast = useToast()
const isSubmitting = ref(false)

// Password validation schema (from technical spec)
const passwordSchema = z.object({
  current: z.string().min(1, 'Current password is required'),
  new: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  current: undefined,
  new: undefined
})

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: 'new', message: 'New password must be different from current password' })
  }
  return errors
}

async function onPasswordSubmit(event: FormSubmitEvent<PasswordSchema>) {
  isSubmitting.value = true

  try {
    await $fetch('/api/account/password', {
      method: 'PUT',
      body: {
        currentPassword: event.data.current,
        newPassword: event.data.new
      }
    })

    toast.add({
      title: 'Password updated',
      description: 'Your password has been changed successfully.',
      icon: 'i-lucide-check',
      color: 'success'
    })

    // Reset form
    password.current = undefined
    password.new = undefined
  } catch (error: unknown) {
    // Check for specific error types
    let message = 'Failed to update password'
    if (error && typeof error === 'object' && 'statusCode' in error) {
      interface FetchError {
        statusCode: number
        message?: string
      }
      const fetchError = error as FetchError
      if (fetchError.statusCode === 401) {
        message = 'Current password is incorrect'
      } else if (fetchError.statusCode === 400 && fetchError.message?.includes('different')) {
        message = 'New password must be different from current password'
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

// Delete account modal
const deleteModalOpen = ref(false)
const isDeleting = ref(false)

async function deleteAccount() {
  isDeleting.value = true

  try {
    await $fetch('/api/account/delete', {
      method: 'DELETE'
    })

    refreshSession()

    toast.add({
      title: 'Account deleted',
      description: 'Your account has been permanently deleted.',
      icon: 'i-lucide-check',
      color: 'success'
    })

    // Redirect to home page
    navigateTo('/')
  } catch (error: unknown) {
    const err = error as H3Error

    toast.add({
      title: 'Error',
      description: err.statusMessage || 'Failed to delete account',
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UPageCard
    title="Password"
    description="Update your password. Must be at least 8 characters with uppercase, lowercase, and a number."
    variant="subtle"
  >
    <UForm
      :schema="passwordSchema"
      :state="password"
      :validate="validate"
      class="flex flex-col gap-4 max-w-xs"
      @submit="onPasswordSubmit"
    >
      <!-- Hidden username field for password managers -->
      <input
        type="text"
        name="username"
        :value="user?.email"
        autocomplete="username"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
      >

      <UFormField
        name="current"
        label="Current password"
        required
      >
        <UInput
          v-model="password.current"
          type="password"
          placeholder="Enter current password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="new"
        label="New password"
        required
        help="Min 8 characters, 1 uppercase, 1 lowercase, 1 number"
      >
        <UInput
          v-model="password.new"
          type="password"
          placeholder="Enter new password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton
        label="Update password"
        class="w-fit"
        type="submit"
        :loading="isSubmitting"
      />
    </UForm>
  </UPageCard>

  <UPageCard
    title="Delete Account"
    description="No longer want to use our service? You can delete your account here. This action is not reversible. All information related to this account will be deleted permanently."
    class="bg-gradient-to-tl from-error/10 from-5% to-default"
  >
    <template #description>
      <UAlert
        v-if="user?.role === 'ADMIN'"
        color="warning"
        variant="subtle"
        icon="i-lucide-shield-alert"
        title="Admin accounts cannot be deleted"
        description="Another admin must change your role to 'Standard' first before you can delete your account."
      />
    </template>

    <template #footer>
      <UButton
        label="Delete account"
        color="error"
        :disabled="user?.role === 'ADMIN'"
        @click="deleteModalOpen = true"
      />
    </template>
  </UPageCard>

  <!-- Delete Account Confirmation Modal -->
  <UModal
    v-model:open="deleteModalOpen"
    title="Delete Account"
    description="This action cannot be undone. Are you absolutely sure?"
  >
    <template #body>
      <div class="space-y-4">
        <div class="p-3 rounded-md bg-error/10 border border-error/20">
          <div class="flex gap-2">
            <UIcon name="i-lucide-alert-triangle" class="text-error shrink-0 mt-0.5" />
            <div class="text-sm text-error">
              <p class="font-medium mb-1">
                Warning: This action is permanent!
              </p>
              <ul class="list-disc list-inside space-y-1">
                <li>Your account will be permanently deleted</li>
                <li>Your booking history will be preserved but unlinked from your account</li>
                <li>You will lose access to all bookings and data</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>
          </div>
        </div>

        <p class="text-sm text-muted">
          If you're sure you want to proceed, click the button below to permanently delete your account.
        </p>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <UButton
          label="Cancel"
          color="neutral"
          variant="subtle"
          @click="deleteModalOpen = false"
        />
        <UButton
          label="Delete My Account"
          color="error"
          :loading="isDeleting"
          @click="deleteAccount"
        />
      </div>
    </template>
  </UModal>
</template>
