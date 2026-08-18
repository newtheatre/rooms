import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'
import * as z from 'zod'

const bodySchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  dryRun: z.boolean().optional()
})

/**
 * Account merge, this app's share (stage-door ADR-0015). Idempotent.
 * Behaviour: docs/api-reference.md#inbound-gdpr-hooks
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { fromUserId, toUserId, dryRun } = await readValidatedBody(event, body => bodySchema.parse(body))

  if (fromUserId === toUserId) {
    throw createError({ statusCode: 400, statusMessage: 'fromUserId and toUserId must differ' })
  }

  const [loser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, fromUserId))
    .limit(1)

  const [bookingCount] = await db
    .select({ value: count() })
    .from(schema.bookings)
    .where(eq(schema.bookings.userId, fromUserId))

  const [subscriptionCount] = await db
    .select({ value: count() })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, fromUserId))

  const counts = {
    bookings: bookingCount?.value ?? 0,
    pushSubscriptions: subscriptionCount?.value ?? 0
  }

  if (!loser || dryRun) {
    return { ok: true, notMirrored: !loser, counts }
  }

  // The winner needs a mirror row before rows point at it; ensureLocalUser
  // replaces this placeholder on their next session.
  await db.batch([
    db.insert(schema.users)
      .values({
        id: toUserId,
        email: `merged-${toUserId}@placeholder.invalid`,
        name: loser.name
      })
      .onConflictDoNothing({ target: schema.users.id }),
    db.update(schema.bookings)
      .set({ userId: toUserId })
      .where(eq(schema.bookings.userId, fromUserId)),
    db.update(schema.pushSubscriptions)
      .set({ userId: toUserId })
      .where(eq(schema.pushSubscriptions.userId, fromUserId)),
    db.delete(schema.users)
      .where(eq(schema.users.id, fromUserId))
  ])

  return { ok: true, notMirrored: false, counts }
})
