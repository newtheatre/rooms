/**
 * Counts for the caller's own bookings. Four numbers, so the home page does
 * not download the whole list to work them out.
 */
import { schema } from '@nuxthub/db'
import { and, eq, gt } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Bookings'],
    summary: 'Booking counts for the signed-in user',
    security: [{ sessionAuth: [] }],
    responses: {
      200: {
        description: 'Counts',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                pending: { type: 'integer' },
                confirmed: { type: 'integer' },
                upcoming: { type: 'integer' }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' }
    }
  }
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const mine = eq(schema.bookings.userId, user.id)
  const now = new Date()

  const [total, pending, confirmed, upcoming] = await Promise.all([
    countRows(schema.bookings, mine),
    countRows(schema.bookings, and(mine, eq(schema.bookings.status, 'PENDING'))),
    countRows(schema.bookings, and(mine, eq(schema.bookings.status, 'CONFIRMED'))),
    countRows(schema.bookings, and(
      mine,
      eq(schema.bookings.status, 'CONFIRMED'),
      gt(schema.bookings.startTime, now)
    ))
  ])

  return { total, pending, confirmed, upcoming }
})
