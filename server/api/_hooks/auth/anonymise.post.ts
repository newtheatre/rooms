import prisma from '~~/server/database'
import { z } from 'zod'

const bodySchema = z.object({ userId: z.string().min(1) })

/**
 * GDPR erasure, this app's share. Idempotent.
 * Scrub list: docs/api-reference.md#inbound-gdpr-hooks
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userId } = await readValidatedBody(event, body => bodySchema.parse(body))

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    // Nothing mirrored here — an erasure of someone who never used rooms.
    return { ok: true }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymised.invalid`,
        name: 'Deleted user',
        isRoomsAdmin: false,
        notificationChannels: '[]',
        notificationPreferences: '[]'
      }
    }),
    prisma.booking.updateMany({
      where: { userId },
      data: { notes: null }
    }),
    prisma.pushSubscription.deleteMany({ where: { userId } })
  ])

  return { ok: true }
})
