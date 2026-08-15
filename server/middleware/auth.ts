/**
 * Protection is opt-OUT: every /api/** request needs a session except the
 * allowlist below. Also upserts the local user mirror.
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
