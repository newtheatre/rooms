# ADR-0001: Move from Prisma to Drizzle, baselining the existing tables

**Status:** Accepted · **Date:** 2026-08-18 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

This app was the estate's one Prisma holdout. `proscenium`, `stage-door` and `rehearsal` all
use Drizzle through NuxtHub's `hub:db` layer, so schema advice, migration workflow and query
idioms did not transfer here, and the repo carried its own local-dev story that nothing else
shared.

That divergence had a running cost out of proportion to the app's size: a committee member who
had learned the schema workflow on any other repo had to learn a second one for this repo alone.

The app also has a live production D1 database. Whatever we changed had to leave those tables and
their rows exactly as they were.

## Decision

Adopt `@nuxthub/core` and Drizzle, matching the other three repos. Access the database through
`import { db, schema } from '@nuxthub/db'`, keep the schema in `server/db/schema/`, and generate
migrations into `server/db/migrations/sqlite/`.

Storage is converted to Drizzle's conventions rather than worked around. Two migrations:

- `0000_baseline_from_prisma` describes the tables Prisma already created, down to the index names.
  Production never runs it; it is recorded as already applied.
- `0001_dates_to_integer_ms` rebuilds every table, converting timestamps.

**The timestamp conversion is the point of this record.** Prisma's storage format depends on the
driver, and the two we had disagreed:

| Where | Driver | `created_at` stored as |
| --- | --- | --- |
| Local development | Prisma on a SQLite file | integer milliseconds |
| **Production** | `@prisma/adapter-d1` | **ISO 8601 text**, `2025-10-08T19:03:51.808+00:00` |

Drizzle's `timestamp_ms` binds an integer. **SQLite compares INTEGER against TEXT by storage class
before value**, so an integer bind never matches a text column: `WHERE start_time < ?` returns no
rows, every conflict lookup comes back empty, and the app cheerfully double-books a room. It fails
silently and only in production, which is the worst combination available.

`0001` therefore rewrites all six tables with integer-millisecond timestamps, converting with
`unixepoch(col, 'subsec') * 1000`. That expression was checked against every production row before
it was trusted; `julianday` was rejected for being a millisecond out on some values.

Booleans needed no conversion: both drivers already stored integer 0/1, so those columns are
`integer(..., { mode: 'boolean' })`.

Autoincrement sequences are restored explicitly. `bookings` had reached 264 with 258 rows, and
letting the rebuilt table derive its counter from `max(id)` would have handed new bookings ids that
already existed.

## Alternatives considered

- **Stay on Prisma.** Free today, but keeps a second ORM, a second migration workflow and a second
  local-dev story in an estate maintained by two or three people at a time. The divergence was
  already documented as an accident of history, not a choice.
- **Keep the production text format** and teach Drizzle to read it, with a `customType` emitting
  the same `+00:00` strings. No data migration and no risk to live rows. Rejected because it leaves
  this repo storing dates differently from the rest of the estate, as text that only sorts
  correctly while every writer agrees on the format, which is a trap for the next person rather
  than a fix.

## Consequences

Good: one ORM, one schema workflow and one set of D1 lessons across the estate. `bun run typecheck`
now passes, so CI can gate on it as the other repos do. Three latent D1 problems were fixed on the
way (below).

Bad: `0001` is a full rebuild of every table in the database. It was rehearsed against a copy of
production and every row and field compared against a backup before it was applied, which is the
only reason to be comfortable with it.

**The cutover is manual and happens before the first deploy of this branch**, in this order:

1. Back up every table. The migration drops the originals.
2. Apply `0001_dates_to_integer_ms.sql` to production.
3. Create `_hub_migrations` and record both migrations, or NuxtHub will try to create tables that
   already exist:

```sql
CREATE TABLE IF NOT EXISTS _hub_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO _hub_migrations (name) VALUES ('0000_baseline_from_prisma'), ('0001_dates_to_integer_ms');
```

Production had no `_prisma_migrations` table: those migrations were applied by hand, so there is
nothing to clean up.

## Fixed on the way

Three things were wrong before this change and are corrected by it:

- **`wrangler` was missing from `devDependencies`**, so Cloudflare dev emulation never started and
  a clean clone could not serve a page that touched the database.
- **The bulk booking endpoints bound one parameter per id**, up to their documented maximum of 100.
  D1 caps a statement at 100 bound parameters, so these were at the limit and would have failed on
  a large enough batch. Both now chunk at 90 (`chunkedByIds`), matching the retention hook.
- **Booking responses carried the whole mirrored user row**, including notification settings, to
  any caller who could see the booking. They now carry an explicit `id`, `name`, `email`
  allow-list, and notification code loads the full row separately.
