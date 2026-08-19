/**
 * Upserts the session user into the local mirror, which bookings FK against.
 * Notification columns are app data and keep their defaults.
 */

import type { User } from '#auth-utils'
import { db, schema } from '@nuxthub/db'

const lastUpserted = new Map<string, number>()
const UPSERT_INTERVAL_MS = 60_000

/** `email` is unique, and ON CONFLICT (id) does not catch a clash on it. */
function isEmailCollision(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE constraint failed: users.email')
}

/** Distinct per id, so two mirrored placeholders cannot collide either. */
function placeholderEmail(userId: string): string {
  return `unmirrored-${userId}@placeholder.invalid`
}

export async function ensureLocalUser(user: User): Promise<void> {
  // Cheap per-isolate debounce, one upsert a minute per user is plenty.
  const last = lastUpserted.get(user.id)
  if (last && Date.now() - last < UPSERT_INTERVAL_MS) return

  // A derived cache for notification fan-out only, so it tracks the role
  // rather than a permission. Never gate on it: the session is authoritative.
  const isRoomsAdmin = hasRole(user, 'rooms', 'ADMIN')

  try {
    await db
      .insert(schema.users)
      .values({ id: user.id, email: user.email, name: user.name, isRoomsAdmin })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { email: user.email, name: user.name, isRoomsAdmin }
      })
  } catch (error) {
    if (!isEmailCollision(error)) throw error

    // Another id already holds this address, which is the pre-merge shadow
    // account state. Mirror everything but the email rather than 500 (ADR-0004).
    await db
      .insert(schema.users)
      .values({ id: user.id, email: placeholderEmail(user.id), name: user.name, isRoomsAdmin })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { name: user.name, isRoomsAdmin }
      })

    console.warn(`[mirror] ${user.email} is held by another id; mirrored ${user.id} without it.`)
  }

  lastUpserted.set(user.id, Date.now())
}
