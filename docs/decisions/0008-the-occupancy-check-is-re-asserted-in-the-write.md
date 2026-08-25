# ADR-0008: The occupancy check is re-asserted in the write

**Status:** Accepted · **Date:** 2026-08-25 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

CLAUDE.md invariant 4 says a pending request holds its slot, so two people cannot both be told yes.
`server/utils/availability.ts` is the single implementation of that rule and
`server/utils/bookingWrites.ts` is the single write path, so no route can forget to ask.

Asking was not enough. `planBookingChange` issued a `SELECT` through
`validateBookingAvailability`, decided in TypeScript, and then wrote a separate `UPDATE` whose
`WHERE` bound the booking id and nothing else. Nothing held the slot in between.

D1 has no interactive transaction. `db.batch` is one transaction, but every statement in it is
fixed before the batch is sent, so a batch cannot re-read and then decide. There is no version
column to build an optimistic check on either: `bookings` carries `created_at` and no
`updated_at`.

Two admins triaging the Monday queue is the ordinary case, not a contrived one. A member's request
carries no room, so overlapping `PENDING` rows with `room_id` NULL are what the queue is made of.
Admin A assigns request 41 to Room 3 for Tuesday 19:00, admin B assigns request 42 to the same room
and window. If B's `SELECT` reaches D1 after A's and before A's `UPDATE`, both see the room free,
both writes succeed, and both members are emailed "has been confirmed in Rehearsal Room 3". Nothing
in either row records the clash, so it surfaces when both casts turn up. The window is not
millisecond-thin: a `scope=series` or bulk assignment plans one statement per occurrence, so the
gap between the first check and the last write is seconds.

## Decision

The `UPDATE` carries the occupancy rule itself:

```sql
where "bookings"."id" = ?
  and not exists (
    select 1 from "bookings" "clash"
    where "clash"."room_id" = ? and "clash"."id" <> ?
      and "clash"."status" in ('CONFIRMED', 'PENDING', 'AWAITING_EXTERNAL')
      and "clash"."start_time" < ? and "clash"."end_time" > ?
  )
```

`planBookingChange` returns that predicate alongside the column changes, so both the single write
in `applyBookingChange` and the batched writes in `PUT /api/bookings/:id` and
`PUT /api/bookings/bulk` carry it. The check cannot be skipped by a route, which is the same reason
the write path was made single in the first place.

Four things the predicate has to get right, and does:

- It is attached only when the status the patch resolves to is one of `CONFIRMED`, `PENDING` or
  `AWAITING_EXTERNAL`. A rejection or a cancellation holds nothing and must not be blocked by a
  clash it is giving up.
- It is skipped entirely when `allowConflicts` is set, which is the documented admin override.
- It matches whichever space `resolveSpace` produced, `room_id` or `external_venue_id`, not
  `room_id` alone, and it keeps the half-open comparison so a booking ending exactly when another
  starts is still not a conflict.
- It binds a fixed number of parameters, eleven at most, whatever the room's booking count.

The `SELECT` stays. It is what produces the 409 payload listing the clashing bookings, which the
predicate cannot do, and it still refuses the whole set before any of it is written.

Zero rows affected has two causes, and `refuseBlockedBookingWrite` separates them: the booking has
gone since it was read, which is a **404**, or a clash landed in between, which is the ordinary
**409** with its conflict list.

## Consequences

Good: two admins confirming different requests into the same room and window can no longer both
succeed. The second write matches nothing and its admin is told which booking took the slot.

Good: occurrences inside one batch are now checked against each other as well. The up-front
`SELECT` only sees committed rows, so a batch could previously stack two of its own statements on
one slot.

Bad: under `?scope=series` and on the bulk route, a clash that lands mid-batch leaves the
occurrences before it applied. `db.batch` is one transaction but a statement matching no rows is
not an error, so the transaction commits and the response is a 409 describing the clash. The admin
refreshes and sees what landed. This is worse than all-or-nothing and better than a double
booking; making it atomic would need D1 to support an interactive transaction, or a statement that
can abort the batch, and neither exists.

Bad: a deliberate double booking made with `allowConflicts` blocks every later change to either
booking unless that flag is sent again. That was already true of the `SELECT`, which re-checks the
resolved state whether or not the patch touches the space or the window, so the predicate adds no
new case.

Neutral: no schema change. An `UPDATE ... WHERE NOT EXISTS` over the same table needs an alias and
nothing else, and `(room_id, start_time, end_time)` already indexes the subquery.
