import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import * as z from 'zod'
import { tombstoneMirroredUser } from '~~/server/utils/mirrorUser'

const bodySchema = z.object({ userId: z.string().min(1) })

/**
 * GDPR erasure, this app's share. Idempotent.
 * Scrub list: docs/api-reference.md#inbound-gdpr-hooks
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userId } = await readValidatedBody(event, body => bodySchema.parse(body))

  // Each statement binds a fixed number of parameters (CLAUDE.md invariant 10).
  await db.batch([
    // Stamped even with nothing mirrored here, or a live cookie mirrors them
    // back and no second erasure is ever sent (ADR-0006).
    tombstoneMirroredUser(userId),
    db.update(schema.bookings)
      .set({ notes: null, rejectionReason: null })
      .where(eq(schema.bookings.userId, userId)),
    db.delete(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId))
  ])

  return { ok: true }
})
