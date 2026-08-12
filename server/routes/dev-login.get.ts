/**
 * DEV ONLY — the single sanctioned exception to "apps never write the
 * session" (stage-door docs/development.md §localhost-cookie-story).
 *
 * Local development without the auth service running: GET /dev-login seals
 * a session for a fake user. Guarded by import.meta.dev — this route does
 * not exist in production builds. `?admin=1` grants rooms:ADMIN.
 */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const { admin } = getQuery(event)
  const now = Date.now()

  await setUserSession(event, {
    user: {
      id: `dev-${admin ? 'admin' : 'user'}`,
      email: `dev-${admin ? 'admin' : 'user'}@rooms.test`,
      name: admin ? 'Dev Admin' : 'Dev User',
      verified: true,
      guest: false,
      roles: admin ? ['rooms:ADMIN'] : []
    },
    loggedInAt: now,
    refreshedAt: now,
    epoch: 0
  })

  return sendRedirect(event, '/', 302)
})
