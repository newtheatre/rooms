import prisma from '~~/server/database'
import { z } from 'zod'

const bodySchema = z.object({ userId: z.string().min(1) })

/**
 * POST /api/_hooks/auth/export — this app's contribution to a subject-access
 * bundle (stage-door docs/gdpr-retention.md). Service-hook auth.
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userId } = await readValidatedBody(event, body => bodySchema.parse(body))

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      notificationChannels: true,
      notificationPreferences: true,
      createdAt: true
    }
  })

  const bookings = await prisma.booking.findMany({
    where: { userId },
    select: {
      eventTitle: true,
      startTime: true,
      endTime: true,
      status: true,
      notes: true,
      numberOfAttendees: true,
      createdAt: true,
      room: { select: { name: true } },
      externalVenue: { select: { roomName: true } }
    },
    orderBy: { startTime: 'desc' }
  })

  const pushSubscriptions = await prisma.pushSubscription.count({ where: { userId } })

  return { data: { profile: user, bookings, pushSubscriptions } }
})
