import { db, schema } from '@nuxthub/db'
import { inArray, max } from 'drizzle-orm'
import * as z from 'zod'

const bodySchema = z.object({ userIds: z.array(z.string().min(1)).max(500) })

/**
 * Feeds the retention sweep: epoch ms of each user's most recent booking.
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userIds } = await readValidatedBody(event, body => bodySchema.parse(body))

  // D1 caps bound parameters at 100; chunk regardless of caller batch size.
  const byUser = new Map<string, number | null>()
  for (let i = 0; i < userIds.length; i += 90) {
    const latest = await db
      .select({ userId: schema.bookings.userId, latest: max(schema.bookings.createdAt) })
      .from(schema.bookings)
      .where(inArray(schema.bookings.userId, userIds.slice(i, i + 90)))
      .groupBy(schema.bookings.userId)

    // max() may or may not run the column's timestamp mapper; normalise to ms.
    for (const row of latest) {
      if (!row.userId) continue
      const value = row.latest
      byUser.set(row.userId, value instanceof Date ? value.getTime() : (value ?? null))
    }
  }

  return Object.fromEntries(userIds.map(id => [id, byUser.get(id) ?? null]))
})
