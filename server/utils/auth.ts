/**
 * Authentication utilities — stage-door integration.
 *
 * The session is the estate-wide `nnt-session` cookie sealed by
 * auth.newtheatre.org.uk. This app reads it (getUserSession) and NEVER
 * writes it. Authorisation stays here: `rooms:ADMIN` is the only role this
 * app owns; logged-in is sufficient for booking requests (carried-forward
 * behaviour).
 */

import type { H3Event } from 'h3'
import type { User } from '#auth-utils'

/**
 * Requires user to be authenticated.
 *
 * @throws 401 Unauthorized if there is no valid session
 */
export async function requireAuth(event: H3Event): Promise<User> {
  const { user } = await getUserSession(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'You must be logged in to access this resource'
    })
  }

  return user
}

/**
 * Requires the `rooms:ADMIN` role.
 *
 * Privileged surfaces must not honour stale roles (session contract §rules):
 * if the session's last DB re-read is older than 15 minutes, this rejects
 * with 401 and a `stale: true` hint — the client middleware bounces the
 * browser through the auth service's refresh endpoint, which re-reads roles
 * and rejects disabled users and revoked sessions.
 *
 * @throws 401 if unauthenticated or the session needs a refresh
 * @throws 403 if authenticated but not a rooms admin
 */
export async function requireAdmin(event: H3Event): Promise<User> {
  const session = await getUserSession(event)

  if (!session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'You must be logged in to access this resource'
    })
  }

  if (isStale(session)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session refresh required',
      data: { stale: true }
    })
  }

  if (!hasRole(session.user, 'rooms', 'ADMIN')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You must be an admin to access this resource'
    })
  }

  return session.user
}
