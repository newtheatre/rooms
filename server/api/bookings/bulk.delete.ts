/**
 * DELETE /api/bookings/bulk: delete many bookings in one request. Admin only.
 *
 * Body: `{ bookingIds: number[] }`. Notifications are grouped by user.
 */
import { db, schema } from '@nuxthub/db'
import { inArray } from 'drizzle-orm'
import { notifyBulkBookingUpdates, formatBookingDateTime } from '~~/server/utils/notifications'
import { z } from 'zod'

const bulkDeleteSchema = z.object({
  bookingIds: z.array(z.number().int().positive()).min(1).max(100)
})

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Delete many bookings',
    description: 'Deletes each listed booking. Notifications are grouped by user.',
    security: [{ sessionAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['bookingIds'],
            properties: {
              bookingIds: {
                type: 'array',
                minItems: 1,
                maxItems: 100,
                items: { type: 'integer' }
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Bookings deleted',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { deleted: { type: 'integer' } }
            }
          }
        }
      },
      400: { description: 'Validation error' },
      401: { description: 'Not authenticated, or the session roles are stale' },
      403: { description: 'Not an admin' },
      404: { description: 'One or more bookings not found' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin session (scoped role via the estate session; staleness-checked)
  await requireAdmin(event)

  // Parse and validate body
  const body = await readBody(event)
  const validation = bulkDeleteSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { bookingIds } = validation.data

  // Chunked: an IN list of the full 100 ids would bind D1's whole parameter
  // budget in one statement (CLAUDE.md invariant 10).
  const bookingsToDelete = await chunkedByIds(bookingIds, ids => db
    .select()
    .from(schema.bookings)
    .where(inArray(schema.bookings.id, ids)))

  if (bookingsToDelete.length !== bookingIds.length) {
    const foundIds = new Set(bookingsToDelete.map(b => b.id))
    const missingIds = bookingIds.filter(id => !foundIds.has(id))
    throw createError({
      statusCode: 404,
      message: 'One or more bookings not found',
      data: { missingIds }
    })
  }

  // Prepare notifications before deletion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifications: Array<{ user: any, booking: any, message: string }> = []

  const usersById = await loadUsersByIds(
    bookingsToDelete.map(b => b.userId).filter((id): id is string => Boolean(id))
  )

  for (const booking of bookingsToDelete) {
    const bookingUser = booking.userId ? usersById.get(booking.userId) : undefined
    if (bookingUser) {
      const bookingDateTime = formatBookingDateTime(booking)
      const message = `Your booking "${booking.eventTitle}" (${bookingDateTime}) has been cancelled by an administrator.`

      notifications.push({
        user: bookingUser,
        booking,
        message
      })
    }
  }

  // Delete all bookings, chunked for the same reason as the read above.
  await chunkedByIds(bookingIds, ids => db
    .delete(schema.bookings)
    .where(inArray(schema.bookings.id, ids))
    .returning({ id: schema.bookings.id }))

  // Send all notifications grouped by user (one email per user with all their deletions)
  await notifyBulkBookingUpdates(notifications).catch((err) => {
    console.error('Failed to send bulk deletion notifications:', err)
  })

  return {
    deleted: bookingsToDelete.length
  }
})
