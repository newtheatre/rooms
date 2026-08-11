/**
 * Authentication middleware — stage-door integration.
 *
 * Login is hosted by the auth service; unauthenticated visitors bounce to
 * it with the way back preserved. In dev use /dev-login instead (see that
 * route).
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    if (import.meta.dev) {
      return navigateTo('/dev-login', { external: true })
    }
    const config = useRuntimeConfig()
    const target = `${useRequestURL().origin}${to.fullPath}`
    return navigateTo(
      `${config.public.authBaseURL}/login?redirect=${encodeURIComponent(target)}`,
      { external: true }
    )
  }
})
