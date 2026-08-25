# ADR-0011: The availability window is capped, and refused rather than truncated

**Status:** Accepted · **Date:** 2026-08-25 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

`GET /api/rooms/available` took a `startTime` and an `endTime` and checked only that the second was
after the first. `getAvailableRooms` passed the pair straight to `findConflicts`, which selects
every overlapping booking joined to its user row, with no limit and no paging, and the space
predicate for that caller is only "has a room". So

```
GET /api/rooms/available?startTime=2000-01-01T00:00:00.000Z&endTime=2100-01-01T00:00:00.000Z
```

read every `CONFIRMED`, `PENDING` and `AWAITING_EXTERNAL` booking in the table into one Worker
isolate, which has 128 MB and a CPU budget. Any signed-in member could ask; `rooms:ADMIN` is not
required, and there is no rate limiting anywhere in this app. The work happened whether or not
`includeUnavailable` was passed, because `totalUnavailable` counts the same rows.

Nothing leaked: a non-admin sees `eventTitle: 'Booked'` and no user object. The cost is latency and
money. D1 bills by rows read, and a century-wide window prunes nothing, so the index is a full
scan. At today's table size it is a slow response; the failure it grows into is the endpoint the
booking form depends on timing out, at which point nobody can check a room before requesting one.

## Decision

Two bounds, neither of which the caller can lift.

**A span cap.** `availableRoomsQuerySchema` refuses a window spanning more than 31 days, with a
400 naming `endTime`. Both callers of `useRoomAvailability` build the window from a single
`eventDate`, so no first-party client ever asks for more than one day and nothing in the UI
changes. 31 days is generous for a hand-written query and still bounds the answer.

**A row cap.** The sweep in `getAvailableRooms` asks for at most 1001 conflicting rows and refuses
with a 400 when it gets more than 1000. The cap is passed only by that caller: `findConflicts` is
shared with `checkRoomAvailability` and `checkVenueAvailability`, which feed
`validateBookingAvailability`, the 409 gate on every write.

**The row cap refuses; it does not truncate.** A `LIMIT` whose overflow is silently dropped would
be a correctness change, not a performance one. The available/unavailable split is derived from
that same row set, so a dropped clash means an occupied room is classified as available and offered
to the next member: the double booking CLAUDE.md invariant 4 exists to prevent. Refusing an answer
we cannot compute honestly is the only safe overflow behaviour, and with the span cap in place no
real request reaches it.

## Consequences

Good: a member can no longer pull the whole bookings table through a Worker, and the endpoint's
cost is bounded by a number rather than by how long the theatre has been running.

Good: the gate on the write path is untouched. It still sees every clash, because the limit is an
argument that only the sweep passes.

Bad: an admin genuinely wanting a term-long overview must ask in chunks. Nothing in the app offers
one, so this is a hypothetical caller rather than a lost feature.

Bad: the two numbers appear in the schema, in the route's OpenAPI block and in the API reference.
`defineRouteMeta` is extracted statically at build time and cannot read a constant, so the block
has to repeat them. Change all three together.

Neutral: the row cap should not fire while the span cap holds. If it ever does, that is a real
signal about the size of the calendar, and the log will carry the 400.
