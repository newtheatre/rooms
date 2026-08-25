# ADR-0006: An erased id always keeps a tombstone row

**Status:** Accepted · **Date:** 2026-08-25 · **Deciders:** Matt Adcock (ITM 26/27) ·
**Supersedes:** [ADR-0005](0005-an-erased-user-is-never-written-back-over.md)

## Context

[ADR-0005](0005-an-erased-user-is-never-written-back-over.md) made `anonymised_at` the thing that
stops an erased mirror row being written back over, and put the guard on the `DO UPDATE` half of
the upsert in `server/utils/mirrorUser.ts`.

Its reasoning has a hole, which it states in one sentence: "the insert half is unaffected, because
an erased row exists and therefore always takes the conflict branch". That is only true while a row
exists. Two paths leave an id with no row at all, and the guard has nothing to hold on to:

- `POST /api/_hooks/auth/anonymise` returned early when it found nothing mirrored, on the
  assumption that the subject had never used rooms. Someone who uses proscenium and rehearsal but
  not rooms is exactly that subject.
- `POST /api/_hooks/auth/merge` deleted the losing mirror row outright. ADR-0005 cleared the merge
  hook on the wrong grounds, looking only at its `onConflictDoNothing` insert of the winner and
  never at its own delete.

Sessions are sealed cookies read locally with no revocation, with a 30 day `maxAge`, and
`server/middleware/auth.ts` calls `ensureLocalUser` ahead of every non-public `/api/**` route. So
the subject's next page load, or a single request from a tab already open, inserted a fresh row
carrying their real name and email with `anonymised_at` null. Nothing would ever scrub it: the auth
service records the hook as complete and does not send it again, and a later erasure of the same
person targets the winner id, not the merged-away one.

For a merge the ghost row is worse than untidy. Bookings the person makes on the stale cookie
attach to the merged-away id, and because the auth service disables the loser they can never sign
in as it again, so those bookings are invisible to them for good.

## Decision

Both hooks leave a tombstone: the scrubbed row, with `anonymised_at` stamped, written as an upsert
so it does not care whether a row was there.

`tombstoneMirroredUser` in `server/utils/mirrorUser.ts` is the one implementation, which keeps that
file the only writer of the mirror. It is a single statement with a fixed parameter count, so it
sits inside the hooks' existing `db.batch`.

`POST /api/_hooks/auth/anonymise` no longer looks for a row first. It writes the tombstone, then
scrubs the bookings and deletes the push subscriptions as before.

`POST /api/_hooks/auth/merge` scrubs the loser in place instead of deleting it. That is factually
what the loser is: the auth service calls its erasure immediately after the app merge hooks
(stage-door ADR-0015), so a merged-away id is an erased account. A stale cookie then lands on a
scrubbed row, which is the consequence ADR-0005 already accepted and wrote down.

The merge hook still writes nothing when the loser was never mirrored here. The erasure the auth
service runs moments later plants the tombstone, and it now does so whether or not a row exists,
which is the whole point of this record.

## Alternatives considered

**Redirect the merged-away id onto the winner**, with a table of merged ids and a lookup in
`ensureLocalUser`. It gives a better outcome for bookings made on a stale cookie, since they would
attach to the winner. Rejected: a new table and a lookup on the hot path of every authenticated
request, to improve a case that lasts at most until the cookie expires.

**Refuse the request instead**, by having `ensureLocalUser` reject a session whose id is erased.
Rejected: cutting a session off is the auth service's to do, and this app would be guessing at it
from the one fact it holds.

## Consequences

Good: erasure holds for a subject who never used rooms, and a merge cannot be undone by the loser's
own browser.

Good: one helper writes every tombstone, so the scrub list cannot drift between the two hooks.

Bad: erasing someone who never used rooms now creates a row here that did not exist before. It
carries no personal data, and `GET /api/users` lists it as "Deleted user" alongside the erasures of
people who did use the app.

Bad: `anonymised_at` is re-stamped on every retry, so it records the last run of the hook rather
than the first. It is a marker, not an audit trail; the audit trail is the auth service's.

Neutral: no schema change. `anonymised_at` and the unique index on `email` are both already there,
and the tombstone address is distinct per id, so it cannot collide.
