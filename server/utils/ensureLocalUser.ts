/**
 * Mirror upsert (stage-door docs/integrating-an-app.md §mirror).
 *
 * Bookings FK a local `users` row; identity lives centrally. On each
 * authenticated request the session user is upserted into the local mirror
 * (idempotent primary-key upsert — migration made local ids canonical).
 * Notification preference columns are app data and keep their defaults on
 * first insert.
 */

import type { User } from '#auth-utils'
import prisma from '~~/server/database'

const lastUpserted = new Map<string, number>()
const UPSERT_INTERVAL_MS = 60_000

export async function ensureLocalUser(user: User): Promise<void> {
  // Cheap per-isolate debounce — one upsert a minute per user is plenty.
  const last = lastUpserted.get(user.id)
  if (last && Date.now() - last < UPSERT_INTERVAL_MS) return

  // isRoomsAdmin is a derived cache for notification fan-out only — the
  // session stays authoritative for authorisation (see schema comment).
  const isRoomsAdmin = hasRole(user, 'rooms', 'ADMIN')

  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email, name: user.name, isRoomsAdmin },
    create: { id: user.id, email: user.email, name: user.name, isRoomsAdmin }
  })
  lastUpserted.set(user.id, Date.now())
}
