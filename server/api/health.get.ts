import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'
import journal from '../db/migrations/sqlite/meta/_journal.json'

/** GET /api/health — uptime check (public). */
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
