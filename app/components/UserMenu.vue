<script setup lang="ts">
/**
 * UserMenu Component
 *
 * User account menu in the sidebar footer.
 * Shows user info, settings, theme controls, and logout.
 */
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const { user, clear } = useUserSession()
const router = useRouter()

// Compute user display data
const userData = computed(() => ({
  name: user.value?.name || 'Guest',
  avatar: user.value?.email
    ? {
        // Generate initials from name
        alt: user.value.name || user.value.email,
        fallback: (user.value.name || user.value.email).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      }
    : undefined
}))

async function logout() {
  await clear()
  await router.push('/login')
}

const items = computed<DropdownMenuItem[][]>(() => ([[{
  type: 'label',
  label: userData.value.name,
  avatar: userData.value.avatar
}], [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings'
}, {
  label: 'Notifications',
  icon: 'i-lucide-bell',
  to: '/settings/notifications'
}, {
  label: 'Security',
  icon: 'i-lucide-shield',
  to: '/settings/security'
}], [{
  label: 'Appearance',
  icon: 'i-lucide-sun-moon',
  children: [{
    label: 'Light',
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.value === 'light',
    onSelect(e: Event) {
      e.preventDefault()

      colorMode.preference = 'light'
    }
  }, {
    label: 'Dark',
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.value === 'dark',
    onUpdateChecked(checked: boolean) {
      if (checked) {
        colorMode.preference = 'dark'
      }
    },
    onSelect(e: Event) {
      e.preventDefault()
    }
  }]
}], [{
  label: 'Log out',
  icon: 'i-lucide-log-out',
  onSelect: logout
}]]))
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        ...userData,
        label: collapsed ? undefined : userData?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />

    <template #chip-leading="{ item }">
      <span
        :style="{
          '--chip-light': `var(--color-${(item as any).chip}-500)`,
          '--chip-dark': `var(--color-${(item as any).chip}-400)`
        }"
        class="ms-0.5 size-2 rounded-full bg-(--chip-light) dark:bg-(--chip-dark)"
      />
    </template>
  </UDropdownMenu>
</template>
