# ADR-0004: An email collision in the user mirror must not break every request

**Status:** Accepted · **Date:** 2026-08-19 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

`users.email` carries a unique index, inherited from the Prisma schema and preserved through the
baseline migration.

`ensureLocalUser` upserts the session user on every authenticated request with
`ON CONFLICT (id) DO UPDATE`. That clause catches a clash on the primary key. It does not catch a
clash on `email`.

Two auth-service ids can legitimately hold the same address for a period:

- The pre-merge shadow account state. `POST /api/users` asks the auth service for a shadow account
  by email, and `POST /api/_hooks/auth/merge` exists precisely to reconcile a duplicate later.
- A member changing their address in stage-door to one another mirror row already holds.

In that window the insert threw `UNIQUE constraint failed: users.email`. Because `ensureLocalUser`
is called from `server/middleware/auth.ts`, which runs ahead of every non-public `/api/**` route,
the affected member got a 500 on every single API call. Nothing in the app could recover it: the
fix was to edit the database by hand.

## Decision

Catch that one constraint failure and mirror the user **without** the email, under a placeholder
unique to their id. Name and admin flag are still mirrored, so bookings and notification fan-out
keep working.

The collision is logged as a warning naming both the address and the id, so an operator can see it
happened and run the merge hook.

The unique index stays. It is what makes the shadow-account match-or-create safe on the auth
service side, and dropping it would let genuine duplicates accumulate silently.

## Alternatives considered

**Drop the unique index.** Simplest, and it makes the failure impossible. Rejected: the index is
the thing that stops two mirror rows for one person from being created and then quietly diverging,
and the merge hook's job would get harder rather than easier.

**Add `email` to the conflict target.** SQLite allows only one conflict target per clause, and the
two cases want different resolutions: an id clash should update the email, an email clash must not
steal it from the row that holds it.

**Reconcile automatically by re-pointing the old row.** Rejected as too clever for a path that runs
on every request. Which of two ids is canonical is the auth service's decision, and it already has
a hook for making it.

## Consequences

Good: a collision degrades one member's mirrored email instead of taking their whole session down.

Good: the placeholder is derived from the id, so two colliding users cannot then collide with each
other on the placeholder.

Bad: the affected member's mirror row holds an address nothing can email until the merge runs. They
will not receive booking notifications in that window. The warning is the only signal, and nothing
alerts on it.

Bad: the check matches on the driver's error message. A D1 or Drizzle change to that wording would
turn the recovery back into a 500. The blast radius is the same as before this change rather than
worse, but it is a string comparison and should be treated as one.
