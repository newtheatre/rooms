/**
 * Upserts the session user into the local mirror, which bookings FK against.
 * Notification columns are app data and keep their defaults.
 */

import type { User } from '#auth-utils'
import { hasRole } from '@newtheatre/auth-types'
import { upsertMirroredUser } from './mirrorUser'

const lastUpserted = new Map<string, number>()
const UPSERT_INTERVAL_MS = 60_000

export async function ensureLocalUser(user: User): Promise<void> {
  // Cheap per-isolate debounce, one upsert a minute per user is plenty.
  const last = lastUpserted.get(user.id)
  if (last && Date.now() - last < UPSERT_INTERVAL_MS) return

  await upsertMirroredUser({
    id: user.id,
    email: user.email,
    name: user.name,
    // A derived cache for notification fan-out only, so it tracks the role
    // rather than a permission. Never gate on it: the session is authoritative.
    isRoomsAdmin: hasRole(user, 'rooms', 'ADMIN')
  })

  lastUpserted.set(user.id, Date.now())
}
