import { db, schema } from '@nuxthub/db'
import { count, desc, eq } from 'drizzle-orm'
import * as z from 'zod'

const bodySchema = z.object({ userId: z.string().min(1) })

/**
 * POST /api/_hooks/auth/export — this app's contribution to a subject-access
 * bundle (stage-door docs/gdpr-retention.md). Service-hook auth.
 */
export default defineEventHandler(async (event) => {
  requireHookAuth(event)
  const { userId } = await readValidatedBody(event, body => bodySchema.parse(body))

  const [user] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
      notificationChannels: schema.users.notificationChannels,
      notificationPreferences: schema.users.notificationPreferences,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  const bookings = await db
    .select({
      eventTitle: schema.bookings.eventTitle,
      startTime: schema.bookings.startTime,
      endTime: schema.bookings.endTime,
      status: schema.bookings.status,
      notes: schema.bookings.notes,
      numberOfAttendees: schema.bookings.numberOfAttendees,
      createdAt: schema.bookings.createdAt,
      room: { name: schema.rooms.name },
      externalVenue: { roomName: schema.externalVenues.roomName }
    })
    .from(schema.bookings)
    .leftJoin(schema.rooms, eq(schema.bookings.roomId, schema.rooms.id))
    .leftJoin(schema.externalVenues, eq(schema.bookings.externalVenueId, schema.externalVenues.id))
    .where(eq(schema.bookings.userId, userId))
    .orderBy(desc(schema.bookings.startTime))

  const [subscriptions] = await db
    .select({ value: count() })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))

  return { data: { profile: user ?? null, bookings, pushSubscriptions: subscriptions?.value ?? 0 } }
})
