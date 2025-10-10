<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user } = useUserSession()

const open = ref(false)

const isAdmin = computed(() => user.value?.role === 'ADMIN')

const links = computed<NavigationMenuItem[][]>(() => {
  const baseLinks: NavigationMenuItem[] = [{
    label: 'Home',
    icon: 'i-lucide-house',
    to: '/',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'My Requests',
    icon: 'i-lucide-calendar-check',
    to: '/requests',
    onSelect: () => {
      open.value = false
    }
  }]

  const adminLinks: NavigationMenuItem[] = isAdmin.value
    ? [{
        label: 'Bookings',
        icon: 'i-lucide-calendar',
        to: '/admin/bookings',
        onSelect: () => {
          open.value = false
        }
      }, {
        label: 'Rooms',
        icon: 'i-lucide-door-open',
        to: '/admin/rooms',
        onSelect: () => {
          open.value = false
        }
      }, {
        label: 'Venues',
        icon: 'i-lucide-map-pin',
        to: '/admin/venues',
        onSelect: () => {
          open.value = false
        }
      }, {
        label: 'Users',
        icon: 'i-lucide-users',
        to: '/admin/users',
        onSelect: () => {
          open.value = false
        }
      }]
    : []

  const settingsLink: NavigationMenuItem = {
    label: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings',
    defaultOpen: true,
    type: 'trigger',
    children: [{
      label: 'Profile',
      to: '/settings',
      exact: true,
      onSelect: () => {
        open.value = false
      }
    }, {
      label: 'Notifications',
      to: '/settings/notifications',
      onSelect: () => {
        open.value = false
      }
    }, {
      label: 'Security',
      to: '/settings/security',
      onSelect: () => {
        open.value = false
      }
    }]
  }

  const docLinks: NavigationMenuItem[] = [{
    label: 'Guides & Documentation',
    icon: 'i-lucide-book-open',
    to: '/docs'
  }]

  return [[...baseLinks, ...adminLinks, settingsLink], docLinks]
})

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat()
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <AppLogo :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
