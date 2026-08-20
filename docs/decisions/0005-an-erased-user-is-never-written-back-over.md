# ADR-0005: An erased user is never written back over

**Status:** Accepted · **Date:** 2026-08-20 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

`ensureLocalUser` upserts the session user into the mirror on every authenticated request, from
`server/middleware/auth.ts`, which runs ahead of every non-public `/api/**` route.

Its `ON CONFLICT (id) DO UPDATE` was unconditional, so it wrote `email` and `name` from the session
over whatever the row held.

Sessions in this estate are sealed cookies read locally, with no revocation call to the auth
service. After stage-door calls `POST /api/_hooks/auth/anonymise`, the erased user's cookie stays
readable until it expires. Their next request to any API route therefore restored the real name and
email over the scrubbed row.

The erasure silently reversed itself, and because stage-door only retries the hook it could not
detect that this had happened. The estate rule is explicit: "an anonymised row must never be
written back over."

There was no column to guard on. The row was identifiable as erased only by its sentinel email,
which nothing checked.

Three places wrote to the mirror: `ensureLocalUser`, `POST /api/users` and
`POST /api/_hooks/auth/merge`. Only one of them would have carried a guard added in place.

## Decision

`users` gains a nullable `anonymised_at`, set by the erasure hook.

`server/utils/mirrorUser.ts` is the one write path into the mirror, and its upsert carries:

```ts
setWhere: isNull(schema.users.anonymisedAt)
```

so the `DO UPDATE` half is skipped for an erased row. The insert half is unaffected, because an
erased row exists and therefore always takes the conflict branch.

`ensureLocalUser` and `POST /api/users` both call it. The admin create returns **409** when the
upsert is held off, rather than reporting a success that did not happen.

The erasure hook itself still writes to `users` directly. It has to: it is the one caller that must
be able to change an erased row, and stage-door retries it until it succeeds.

`POST /api/_hooks/auth/merge` is left as it is. It inserts the winner with `onConflictDoNothing`,
which cannot overwrite an existing row of any kind, so it cannot resurrect one.

`proscenium` solved the same problem the same way (its ADR-0014), which is why the column name and
the `setWhere` shape match rather than being invented here.

## Consequences

Good: erasure holds. Verified against a local SQLite database with the exact statements the code
issues: a request arriving after erasure leaves the scrubbed row untouched, and a retried hook is
still idempotent.

Good: a fourth writer cannot appear without going through `upsertMirroredUser`, because nothing
else inserts into `users` any more.

Bad: an erased user with a live cookie can still sign in and browse. Their mirror row no longer
carries their details, so bookings they create attach to an anonymised row. Cutting the session off
at erasure is stage-door's to do, not this app's, and is not attempted here.

Bad: `anonymised_at` records when this app scrubbed its share, which is not necessarily when the
account was erased centrally. It is a marker, not an audit trail; the audit trail is stage-door's.

Neutral: the column is nullable with no default, so the migration is a single `ALTER TABLE ADD
COLUMN` and every existing row reads as not erased, which is correct.
