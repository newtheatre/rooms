/**
 * The session is written only by the auth service; this app reads it.
 * Checks name a permission from appManifest.ts, not the role that implies it.
 */

import type { H3Event } from 'h3'
import type { User } from '#auth-utils'
import { isStale } from '@newtheatre/auth-types'

/**
 * A permission claim, refused if the roles backing it are too old to trust.
 * Someone without the permission gets `false` rather than a refresh prompt.
 */
export async function canNow(event: H3Event, permission: Permission): Promise<boolean> {
  const session = await getUserSession(event)

  if (!session.user || !can(session.user, permission)) {
    return false
  }

  if (isStale(session)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Session refresh required',
      data: { stale: true }
    })
  }

  return true
}

/**
 * 401 if there is no valid session.
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
 * Requires `admin.access`. A session whose roles are over 15 minutes old gets
 * 401 with `stale: true`, which the client turns into a refresh.
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

  if (!can(session.user, 'admin.access')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You must be an admin to access this resource'
    })
  }

  return session.user
}
