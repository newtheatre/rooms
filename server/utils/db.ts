/**
 * Row helpers for Drizzle results. `returning()` and `select()` are typed as
 * arrays, but a write that must affect one row should say so at the call site.
 */

/** The row a write returned, or a 500. Use where absence is a bug, not a 404. */
export function requireRow<T>(rows: T[]): T {
  const row = rows[0]
  if (!row) {
    throw createError({ statusCode: 500, statusMessage: 'Database write returned no row' })
  }
  return row
}

/** The row, or undefined. Callers decide whether that is a 404. */
export function firstRow<T>(rows: T[]): T | undefined {
  return rows[0]
}

/**
 * D1 caps a statement at 100 bound parameters, so an id list is never sent
 * whole. 90 leaves room for the statement's other bindings (CLAUDE.md 10).
 */
const ID_CHUNK = 90

export async function chunkedByIds<Id, Row>(
  ids: Id[],
  run: (chunk: Id[]) => Promise<Row[]>
): Promise<Row[]> {
  const out: Row[] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    out.push(...await run(ids.slice(i, i + ID_CHUNK)))
  }
  return out
}
