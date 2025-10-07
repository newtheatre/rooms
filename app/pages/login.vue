/**
 * User Login Page
 *
 * Public route for user authentication.
 *
 * Features:
 * - Email/password login form
 * - Form validation (Zod schema)
 * - Error handling and display
 * - Redirect to dashboard on success
 * - Link to registration page
 *
 * Uses nuxt-auth-utils:
 * - useUserSession() composable for login state
 * - POST to /api/auth/login
 * - Automatic redirect if already logged in
 *
 * @route /login
 * @public
 */
<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'
import { H3Error } from 'h3'

definePageMeta({
  layout: 'auth',
  middleware: ['guest']
})

const { fetch: fetchSession } = useUserSession()
const router = useRouter()
const toast = useToast()

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
} // , {
//   name: 'remember',
//   label: 'Remember me',
//   type: 'checkbox'
// }
]

// Login form schema
const schema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

type Schema = z.output<typeof schema>

// Form submission
async function onSubmit(event: FormSubmitEvent<Schema>) {
  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: event.data
    })

    // Refresh session
    await fetchSession()

    toast.add({
      title: 'Welcome back!',
      description: `Logged in as ${response.email}`,
      icon: 'i-lucide-check-circle',
      color: 'success'
    })

    // Redirect to dashboard
    await router.push('/')
  } catch (error: unknown) {
    const errorMessage = error instanceof H3Error
      ? error.message
      : 'Invalid email or password'

    toast.add({
      title: 'Login failed',
      description: errorMessage,
      icon: 'i-lucide-x-circle',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        title="Welcome back!"
        icon="i-lucide-lock"
        @submit="onSubmit"
      >
        <template #description>
          Don't have an account? <ULink to="/register" class="text-primary font-medium">Sign up</ULink>.
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
          By signing in, you agree to our <ULink to="/terms" class="text-primary font-medium">Terms of Service</ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
