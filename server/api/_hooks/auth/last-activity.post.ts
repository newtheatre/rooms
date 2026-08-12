import prisma from '~~/server/database'
import { z } from 'zod'

const bodySchema = z.object({ userIds: z.array(z.string().min(1)).max(500) })

/**
 * POST /api/_hooks/auth/last-activity — feeds the retention sweep
 * (stage-door docs/gdpr-retention.md): epoch ms of each user's most recent
 * booking creation, null where none is known.
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userIds } = await readValidatedBody(event, body => bodySchema.parse(body))

  // D1 caps bound parameters at 100 — chunk regardless of caller batch size.
  const byUser = new Map<string, number | null>()
  for (let i = 0; i < userIds.length; i += 90) {
    const latest = await prisma.booking.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds.slice(i, i + 90) } },
      _max: { createdAt: true }
    })
    for (const row of latest) byUser.set(row.userId, row._max.createdAt?.getTime() ?? null)
  }

  return Object.fromEntries(userIds.map(id => [id, byUser.get(id) ?? null]))
})
