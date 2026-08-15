<script setup lang="ts">
/**
 * Name and email belong to the central account and are edited there; this
 * shows what the session carries.
 */
const { user } = useUserSession()
const config = useRuntimeConfig()

definePageMeta({
  middleware: ['auth']
})
</script>

<template>
  <UPageCard
    title="Profile"
    description="Your NNT account is shared across all NNT sites. Name and email changes made there apply everywhere."
    icon="i-lucide-user"
    variant="subtle"
  >
    <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt class="text-muted">
        Name
      </dt>
      <dd>{{ user?.name }}</dd>
      <dt class="text-muted">
        Email
      </dt>
      <dd>
        {{ user?.email }}
        <UBadge
          v-if="user?.verified"
          color="success"
          variant="subtle"
          size="sm"
          class="ml-2"
        >
          Verified
        </UBadge>
      </dd>
    </dl>

    <UButton
      :to="`${config.public.authBaseURL}/account`"
      external
      icon="i-lucide-external-link"
      class="self-start mt-4"
    >
      Edit your NNT account
    </UButton>
  </UPageCard>
</template>
