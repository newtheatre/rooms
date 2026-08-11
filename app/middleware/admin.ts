/**
 * Admin authorisation middleware — stage-door integration.
 *
 * Requires the estate session plus the scoped `rooms:ADMIN` role. Roles
 * ride in the sealed cookie, so before honouring one on a privileged
 * surface the session must be fresh (≤15 min since the auth service last
 * re-read the DB — session contract §rules). Stale sessions bounce through
 * the auth service's refresh endpoint, which re-seals with current roles
 * and rejects revoked/disabled users.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user, session } = useUserSession()
  const config = useRuntimeConfig()
  const target = `${useRequestURL().origin}${to.fullPath}`

  if (!loggedIn.value) {
    if (import.meta.dev) {
      return navigateTo('/dev-login?admin=1', { external: true })
    }
    return navigateTo(
      `${config.public.authBaseURL}/login?redirect=${encodeURIComponent(target)}`,
      { external: true }
    )
  }

  if (!import.meta.dev && isStale(session.value)) {
    return navigateTo(
      `${config.public.authBaseURL}/api/session/refresh?redirect=${encodeURIComponent(target)}`,
      { external: true }
    )
  }

  if (!hasRole(user.value, 'rooms', 'ADMIN')) {
    return navigateTo('/')
  }
})
