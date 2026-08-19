/**
 * DEV ONLY: the one sanctioned exception to "apps never write the session".
 * `?admin=1` grants rooms:ADMIN. Guarded by import.meta.dev.
 */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const { admin } = getQuery(event)
  const now = Date.now()

  // replaceUserSession, NOT setUserSession: set merges with defu, which
  // concatenates arrays, so switching persona would keep the old roles.
  await replaceUserSession(event, {
    user: {
      id: `dev-${admin ? 'admin' : 'user'}`,
      email: `dev-${admin ? 'admin' : 'user'}@rooms.test`,
      name: admin ? 'Dev Admin' : 'Dev User',
      verified: true,
      guest: false,
      roles: admin ? [`${APP_MANIFEST.namespace}:ADMIN`] : []
    },
    loggedInAt: now,
    refreshedAt: now,
    epoch: 0
  })

  return sendRedirect(event, '/', 302)
})
