import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'
import journal from '../db/migrations/sqlite/meta/_journal.json'

defineRouteMeta({
  openAPI: {
    tags: ['Other'],
    summary: 'Uptime and schema check',
    description: 'Returns 503 naming pending migrations when the deployed code is ahead of the database schema (stage-door ADR-0021).',
    responses: {
      200: {
        description: 'Healthy',
        content: {
          'application/json': {
            schema: { type: 'object', properties: { ok: { type: 'boolean', enum: [true] } } }
          }
        }
      },
      503: {
        description: 'The schema is behind the deployed code',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                ok: { type: 'boolean', enum: [false] },
                pendingMigrations: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  }
})

/** GET /api/health: uptime check (public). */
export default defineEventHandler(async (event) => {
  // Both ledger spellings exist: nuxt-db migrate records the bare tag,
  // wrangler records it with .sql. Compare on the tag.
  const expected = journal.entries.map(entry => entry.tag)

  async function pendingMigrations(): Promise<string[]> {
    try {
      const rows = await db.all<{ name: string }>(sql`select name from _hub_migrations`)
      const applied = new Set(rows.map(r => r.name.replace(/\.sql$/, '')))
      return expected.filter(tag => !applied.has(tag))
    } catch (error) {
      console.error('[health] could not read _hub_migrations:', error)
      return expected
    }
  }

  const pending = await pendingMigrations()

  if (pending.length) {
    // The deployed code was built against a schema this database does not
    // have (stage-door ADR-0021).
    setResponseStatus(event, 503)
    return { ok: false, pendingMigrations: pending }
  }

  return { ok: true }
})
