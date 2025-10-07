/**
 * Guest Middleware
 *
 * Prevents authenticated users from accessing guest-only routes
 * (like login and registration pages).
 * Redirects to / (dashboard) if already logged in.
 */
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (loggedIn.value) {
    return navigateTo('/')
  }
})
