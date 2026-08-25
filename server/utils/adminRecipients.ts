/**
 * Who receives the admin fan-out, asked of stage-door rather than read off the
 * mirror's cached flag (ADR-0009).
 */

import { db, schema } from '@nuxthub/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { User } from '~~/server/db/schema/user'

/** Advisory-fresh. The holder list changes at handover, not hourly. */
const CACHE_TTL_MS = 10 * 60 * 1000

/** Per-isolate, and never per-user: this is not the caller's data. */
let cache: { ids: string[], at: number } | null = null

/** Our own roles carrying the admin surface, from the manifest that defines them. */
function rolesCarryingAdminAccess(): string[] {
  return APP_MANIFEST.roles
    .filter(role => (role.permissions as readonly string[]).includes('admin.access'))
    .map(role => role.role)
}

/** The ids stage-door says hold the role, or null when it cannot say. */
async function adminHolderIds(): Promise<string[] | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.ids

  const config = useRuntimeConfig()
  if (!config.authServiceToken) return cache?.ids ?? null

  try {
    const response = await $fetch<{ holders: Array<{ id: string }> }>(
      `${config.public.authBaseURL}/api/role-holders`,
      {
        query: { roles: rolesCarryingAdminAccess().join(',') },
        headers: { Authorization: `Bearer ${config.authServiceToken}` },
        timeout: 4000
      }
    )

    const ids = response.holders.map(holder => holder.id)
    cache = { ids, at: Date.now() }
    return ids
  } catch (error) {
    console.error('[adminRecipients] could not reach stage-door for the holder list:', error)
    return cache?.ids ?? null
  }
}

/** The mirror rows for those ids, since the fan-out needs their preferences. */
async function mirroredAdmins(ids: string[]): Promise<User[]> {
  if (!ids.length) return []

  // Chunked, so the parameter count is fixed however many hold the role.
  return chunkedByIds(ids, chunk => db
    .select()
    .from(schema.users)
    .where(and(
      inArray(schema.users.id, chunk),
      isNull(schema.users.anonymisedAt)
    )))
}

/**
 * Admins to fan out to. Falls back to the cached flag when stage-door is
 * unreachable: stale beats silence for a booking nobody would otherwise see.
 */
export async function adminRecipients(): Promise<User[]> {
  const ids = await adminHolderIds()

  if (!ids) {
    console.warn('[adminRecipients] falling back to the mirror flag, which does not lapse at handover.')
    return db.select().from(schema.users).where(eq(schema.users.isRoomsAdmin, true))
  }

  return mirroredAdmins(ids)
}

/** Testing seam: the cache is per-isolate and otherwise invisible. */
export function clearAdminRecipientCache() {
  cache = null
}
