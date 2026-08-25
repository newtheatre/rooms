import { db, schema } from '@nuxthub/db'
import { count, eq } from 'drizzle-orm'
import * as z from 'zod'
import { tombstoneMirroredUser } from '~~/server/utils/mirrorUser'
import { isDeliverable } from '~~/server/utils/notifications'

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

  // A synthetic address bounces every booking email until the winner next
  // signs in, and the loser's is the same person's.
  const winnerEmail = isDeliverable(loser) ? loser.email : `merged-${toUserId}@placeholder.invalid`

  // The winner needs a mirror row before rows point at it; ensureLocalUser
  // replaces whatever this holds on their next session.
  await db.batch([
    // First, so the winner can take the address it frees. Scrubbed not deleted:
    // the loser's cookie would insert the row it just lost (ADR-0006).
    tombstoneMirroredUser(fromUserId),
    db.insert(schema.users)
      .values({
        id: toUserId,
        email: winnerEmail,
        name: loser.name
      })
      .onConflictDoNothing({ target: schema.users.id }),
    db.update(schema.bookings)
      .set({ userId: toUserId })
      .where(eq(schema.bookings.userId, fromUserId)),
    db.update(schema.pushSubscriptions)
      .set({ userId: toUserId })
      .where(eq(schema.pushSubscriptions.userId, fromUserId))
  ])

  return { ok: true, notMirrored: false, counts }
})
