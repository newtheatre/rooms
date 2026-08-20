import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import * as z from 'zod'

const bodySchema = z.object({ userId: z.string().min(1) })

/**
 * GDPR erasure, this app's share. Idempotent.
 * Scrub list: docs/api-reference.md#inbound-gdpr-hooks
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userId } = await readValidatedBody(event, body => bodySchema.parse(body))

  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  if (!user) {
    // Nothing mirrored here, an erasure of someone who never used rooms.
    return { ok: true }
  }

  // Each statement binds a fixed number of parameters (CLAUDE.md invariant 10).
  await db.batch([
    db.update(schema.users)
      .set({
        email: `deleted-${userId}@anonymised.invalid`,
        name: 'Deleted user',
        isRoomsAdmin: false,
        notificationChannels: '[]',
        notificationPreferences: '[]',
        anonymisedAt: new Date()
      })
      .where(eq(schema.users.id, userId)),
    db.update(schema.bookings)
      .set({ notes: null, rejectionReason: null })
      .where(eq(schema.bookings.userId, userId)),
    db.delete(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId))
  ])

  return { ok: true }
})
