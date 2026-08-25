# ADR-0009: Admin fan-out asks stage-door who holds the role

**Status:** Accepted · **Date:** 2026-08-25 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

`users.is_rooms_admin` is a cache, not an authority. Nothing gates access on it; it exists so the
notification fan-out has something to select on, because a fan-out has no session to read roles
from.

`ensureLocalUser` is its only writer, and it only runs while that person keeps making authenticated
requests to this app. `APP_MANIFEST` gives `rooms:ADMIN` a `committee-year` expiry, so the whole
outgoing committee loses the role on the same day, and the one thing an outgoing committee member
reliably does not do is sign in to the room-booking system again. Their mirror row kept
`is_rooms_admin = 1` for good.

Every new booking request was therefore still bcc'd to them, carrying the requester's name, the
event title, the date, the attendee count and their free-text notes, as was every member
cancellation. It stopped only if they happened to sign in once more, which is exactly what the
lapse makes unlikely. stage-door's integration guide says the derived cache "self-heals within the
staleness window"; self-healing depends on the holder coming back.

Nothing pushes a role change to a consumer, and nothing could: `AppHook` is a closed union of
`export`, `anonymise`, `last-activity` and `merge`, and a committee-year expiry is a passive lapse
with no revocation event to send even if the union were opened.

The same lookup and the same preference filter were also written out twice, in
`server/utils/notifications.ts` and again inline in `POST /api/bookings`, so any fix would have had
to be made in both.

## Decision

`server/utils/adminRecipients.ts` resolves the recipients by asking stage-door
`GET /api/role-holders?roles=ADMIN`, which is service-token authenticated, scoped to the caller's
own namespace, and filtered on `effectiveRoleCondition()` so a lapsed grant is not a holder. The
roles it names come from `APP_MANIFEST`, filtered to those carrying `admin.access`, rather than
being spelled out again.

The returned ids are intersected against the local mirror, chunked, because the fan-out needs the
notification columns and because an id we have never mirrored has no preferences to read. Erased
rows are excluded there as well.

The answer is cached per isolate for ten minutes. The holder list changes at handover, not hourly.

When stage-door cannot be reached, the cached flag is used and a warning is logged. Stale beats
silence here: the failure mode of sending nothing is a booking request nobody sees.

`notifyAdmins` is now the only fan-out. The duplicate block in `POST /api/bookings` calls it
instead of repeating the query and the filter.

## Consequences

Good: a lapsed grant stops receiving members' booking details within ten minutes of the isolate's
next fan-out, without anyone having to remember to clear a flag.

Good: `proscenium` already consumes the same endpoint the same way (its `server/utils/tabHolders.ts`),
so this is one estate idiom rather than two.

Bad: the booking-creation path now makes a network call on a cache miss. It is behind a four-second
timeout and a `catch`, and the notification is already fired with `.catch` by its caller, so a slow
or unreachable auth service delays the response rather than failing it.

Bad: `is_rooms_admin` stays in the schema and stays stale. It is now the fallback rather than the
answer, and `docs/data-model.md` says so. Dropping it would leave nothing to fall back to when
stage-door is unreachable.

Neutral: `NUXT_AUTH_SERVICE_TOKEN` is already required for `POST /api/users`, so this adds no new
configuration. Without it the fallback path is taken, as before.
