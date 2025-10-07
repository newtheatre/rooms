/**
 * Admin Authorization Middleware
 *
 * Ensures the user is authenticated AND has admin role.
 * Redirects to /login if not authenticated.
 * Redirects to / (dashboard) if authenticated but not admin.
 *
 * Apply this to routes that require admin access.
 */
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  if (user.value?.role !== 'ADMIN') {
    return navigateTo('/')
  }
})
