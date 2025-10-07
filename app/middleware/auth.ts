/**
 * Authentication Middleware
 *
 * Ensures the user is authenticated before accessing protected routes.
 * Redirects to /login if not authenticated.
 *
 * Apply this to routes that require any authenticated user.
 */
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
