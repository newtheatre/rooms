/**
 * List local user mirrors. Admin only. `search` matches name and email.
 */
import { db, schema } from '@nuxthub/db'
import { count, desc, eq, like, or } from 'drizzle-orm'

defineRouteMeta({
  openAPI: {
    tags: ['Users'],
    summary: 'List users',
    description: 'Retrieves all user accounts (admin only)',
    security: [{ sessionAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'search',
        schema: { type: 'string' },
        description: 'Search by name or email'
      }
    ],
    responses: {
      200: {
        description: 'List of users',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  bookingCount: { type: 'integer' }
                }
              }
            }
          }
        }
      },
      401: { description: 'Not authenticated' },
      403: { description: 'Not admin' }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin authentication
  await requireAdmin(event)

  // Parse query parameters. Roles now live in the central auth service —
  // this mirror table has no role column to filter by.
  const query = getQuery(event)
  const searchFilter = query.search as string | undefined

  const where = searchFilter
    ? or(
        like(schema.users.name, `%${searchFilter}%`),
        like(schema.users.email, `%${searchFilter}%`)
      )
    : undefined

  // Column allow-listed: the mirror also holds notification settings.
  return await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
      bookingCount: count(schema.bookings.id)
    })
    .from(schema.users)
    .leftJoin(schema.bookings, eq(schema.bookings.userId, schema.users.id))
    .where(where)
    .groupBy(schema.users.id)
    .orderBy(desc(schema.users.createdAt))
})
