/**
 * Global API guard — protection is opt-OUT, not opt-in (this was the app's
 * biggest pre-integration footgun; stage-door docs/integrating-an-app.md §3).
 *
 * Every /api/** request needs a valid estate session except the explicit
 * public allowlist. Also upserts the local user mirror for authenticated
 * requests (bookings FK against it).
 */

const PUBLIC_API = [
  /^\/api\/_content\//, // @nuxt/content (docs pages)
  /^\/api\/_auth\//, // nuxt-auth-utils session read
  /^\/api\/_hooks\//, // GDPR hooks — carry their own service-hash bearer auth
  /^\/api\/health$/
]

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  if (PUBLIC_API.some(pattern => pattern.test(event.path))) return

  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'You must be logged in to access this resource'
    })
  }

  await ensureLocalUser(user)
})
