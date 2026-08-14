import prisma from '~~/server/database'
import { z } from 'zod'

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

  const loser = await prisma.user.findUnique({ where: { id: fromUserId } })

  const counts = {
    bookings: await prisma.booking.count({ where: { userId: fromUserId } }),
    pushSubscriptions: await prisma.pushSubscription.count({ where: { userId: fromUserId } })
  }

  if (!loser || dryRun) {
    return { ok: true, notMirrored: !loser, counts }
  }

  // The winner needs a mirror row before rows point at it; ensureLocalUser
  // replaces this placeholder on their next session.
  await prisma.$transaction([
    prisma.user.upsert({
      where: { id: toUserId },
      update: {},
      create: {
        id: toUserId,
        email: `merged-${toUserId}@placeholder.invalid`,
        name: loser.name
      }
    }),
    prisma.booking.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId }
    }),
    prisma.pushSubscription.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId }
    }),
    prisma.user.delete({ where: { id: fromUserId } })
  ])

  return { ok: true, notMirrored: false, counts }
})
