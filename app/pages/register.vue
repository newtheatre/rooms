/**
 * User Registration Page
 *
 * Public route for creating new user accounts.
 *
 * Features:
 * - Registration form (name, email, password) with UAuthForm
 * - Form validation (Zod schema)
 * - Error handling (duplicate email, etc.)
 * - Auto-login after successful registration
 * - Link to login page
 *
 * Uses nuxt-auth-utils:
 * - POST to /api/auth/register
 * - setUserSession on success
 * - Redirect to dashboard after registration
 *
 * @route /register
 * @public
 */
<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  middleware: ['guest']
})

const { loggedIn, fetch: fetchSession } = useUserSession()
const router = useRouter()
const toast = useToast()

// Redirect if already logged in
if (loggedIn.value) {
  await navigateTo('/')
}

// Registration form schema (matches server validation)
const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})

type Schema = z.output<typeof schema>

// Define fields for UAuthForm
const fields: AuthFormField[] = [
  {
    name: 'name',
    type: 'text',
    label: 'Full name',
    placeholder: 'Enter your full name',
    icon: 'i-lucide-user',
    required: true
  },
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    icon: 'i-lucide-mail',
    required: true
  },
  {
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'Create a strong password',
    icon: 'i-lucide-lock',
    help: 'Min 8 characters, 1 uppercase, 1 lowercase, 1 number',
    required: true
  }
]

const isSubmitting = ref(false)

// Form submission
async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true

  try {
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: event.data
    }) as { id: string, email: string, name: string, role: string }

    // Refresh session (user is auto-logged in after registration)
    await fetchSession()

    toast.add({
      title: 'Account created!',
      description: `Welcome, ${response.name}!`,
      icon: 'i-lucide-check-circle',
      color: 'success'
    })

    // Redirect to dashboard
    await router.push('/')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'Registration failed'

    toast.add({
      title: 'Registration failed',
      description: errorMessage,
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        title="Create your account"
        icon="i-lucide-user-plus"
        :submit="{ label: 'Create account' }"
        @submit="onSubmit"
      >
        <template #description>
          Already have an account? <ULink to="/login" class="text-primary font-medium">Sign in</ULink>.
        </template>
        <!-- TODO: <template #password-hint>
          <ULink to="#" class="text-primary font-medium" tabindex="-1">Forgot password?</ULink>
        </template> -->
        <!-- TODO: <template #validation>
          <UAlert
            v-if="error"
            color="error"
            icon="i-lucide-info"
            title="Error signing in"
          />
        </template> -->
        <template #footer>
          By signing up, you agree to our <ULink to="/terms" class="text-primary font-medium">Terms of Service</ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
