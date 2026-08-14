/**
 * DEV ONLY — the one sanctioned exception to "apps never write the session".
 * `?admin=1` grants rooms:ADMIN. Guarded by import.meta.dev.
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
