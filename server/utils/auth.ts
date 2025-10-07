/**
 * Authentication Utilities
 *
 * Provides helper functions for user authentication, authorization,
 * and session management.
 *
 * @module server/utils/auth
 */

import type { H3Event } from 'h3'
import type { User } from '#auth-utils'

/**
 * Requires user to be authenticated
 *
 * Throws 401 error if user is not authenticated.
 *
 * @param event - H3 event object
 * @returns User session data
 * @throws 401 Unauthorized if user is not authenticated
 *
 * @example
 * ```ts
 * const user = await requireAuth(event)
 * // user is guaranteed to be authenticated here
 * ```
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
 * Requires user to have admin role
 *
 * Throws 401 if not authenticated, 403 if not admin.
 *
 * @param event - H3 event object
 * @returns User session data for admin user
 * @throws 401 Unauthorized if user is not authenticated
 * @throws 403 Forbidden if user is not an admin
 *
 * @example
 * ```ts
 * const admin = await requireAdmin(event)
 * // user is guaranteed to be an authenticated admin
 * ```
 */
export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireAuth(event)

  if (user.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'You must be an admin to access this resource'
    })
  }

  return user
}
