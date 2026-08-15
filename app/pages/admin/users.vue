<script setup lang="ts">
/**
 * The app-side view of who exists locally. Identity, credentials and roles are
 * the auth service's; this page deep-links there.
 */
interface UserRow {
  id: string
  email: string
  name: string
  createdAt: string
  bookingCount: number
}

definePageMeta({
  middleware: ['admin']
})

const config = useRuntimeConfig()
const search = ref('')

const { data: users, status, refresh } = await useFetch<UserRow[]>('/api/users', {
  query: computed(() => (search.value ? { search: search.value } : {}))
})

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'bookingCount', header: 'Bookings' },
  { accessorKey: 'created', header: 'Joined' }
]

const rows = computed(() => (users.value ?? []).map(user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  bookingCount: user.bookingCount,
  created: new Date(user.createdAt).toLocaleDateString('en-GB')
})))
</script>

<template>
  <UDashboardPanel id="admin-users">
    <template #header>
      <UDashboardNavbar title="Users">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            :to="`${config.public.authBaseURL}/admin`"
            external
            target="_blank"
            variant="outline"
            icon="i-lucide-external-link"
            label="Manage accounts & roles"
          />
          <UsersAddModal @refresh="refresh" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        title="Identity is managed centrally"
        description="Names, emails, passwords, and the rooms:ADMIN role are edited in the NNT account admin (button above). This list shows who exists here and their booking activity."
        class="mb-4"
      />

      <UInput
        v-model="search"
        placeholder="Search by name or email…"
        icon="i-lucide-search"
        class="mb-4 w-72"
      />

      <UTable
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
      />
    </template>
  </UDashboardPanel>
</template>
