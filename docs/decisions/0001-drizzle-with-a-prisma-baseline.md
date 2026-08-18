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

**The existing tables are not rebuilt.** The Drizzle schema is written to describe the tables
Prisma already created, down to the index names, and migration `0000_baseline_from_prisma`
reproduces them exactly. Production never runs it: the migration is marked as already applied.

Two mapping details make that faithful, and both are load-bearing:

- Prisma stores SQLite `DATETIME` as **integer milliseconds since the epoch**, not text. Every
  such column is `integer(..., { mode: 'timestamp_ms' })`.
- Prisma stores `BOOLEAN` as integer 0/1, so those are `integer(..., { mode: 'boolean' })`.

The declared column types therefore differ from the live DDL (`integer` where SQLite was told
`DATETIME`). SQLite is dynamically typed and the stored values are unchanged, so reads and writes
behave identically.

## Alternatives considered

- **Stay on Prisma.** Free today, but keeps a second ORM, a second migration workflow and a second
  local-dev story in an estate maintained by two or three people at a time. The divergence was
  already documented as an accident of history, not a choice.
- **Dump and reload the data into fresh Drizzle-generated tables.** Would have made the DDL match
  the snapshot exactly. Rejected: it turns a code change into a data migration against live
  booking records, for a cosmetic gain.

## Consequences

Good: one ORM, one schema workflow and one set of D1 lessons across the estate. `bun run typecheck`
now passes, so CI can gate on it as the other repos do. Three latent D1 problems were fixed on the
way (below).

Bad: the live DDL and the Drizzle snapshot describe the same tables in different words. Anyone
introspecting production and diffing it against the snapshot will see type-name noise that is not a
real difference. Any future migration is generated against the snapshot, which is the authority.

**The cutover is manual and must happen before the first deploy of this branch.** NuxtHub tracks
applied migrations in `_hub_migrations`, which production does not have. Create it and record the
baseline as applied, or NuxtHub will try to create tables that already exist:

```sql
CREATE TABLE IF NOT EXISTS _hub_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO _hub_migrations (name) VALUES ('0000_baseline_from_prisma');
```

`_prisma_migrations` can be dropped afterwards, at leisure. It is inert once Prisma is gone.

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
