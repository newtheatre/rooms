<script setup lang="ts">
/**
 * Passwords and session security live in the central account service; this
 * page links out.
 */
const config = useRuntimeConfig()

definePageMeta({
  middleware: ['auth']
})
</script>

<template>
  <UPageCard
    title="Account security"
    description="Your NNT account is shared across all NNT sites — passwords, Google sign-in, and logging out everywhere are managed in one place."
    icon="i-lucide-shield"
    variant="subtle"
  >
    <UButton
      :to="`${config.public.authBaseURL}/account`"
      external
      icon="i-lucide-external-link"
      class="self-start"
    >
      Manage your NNT account
    </UButton>
  </UPageCard>
</template>
