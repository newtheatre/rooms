# Data model

The schema is `server/db/schema/`, one file per domain area; this document is the reference that
does not fit in its comments. Drizzle through NuxtHub's `hub:db` layer, as the rest of the estate.

Table names are snake_case, given explicitly to each column; the TypeScript fields are camelCase.

Two storage details matter when reading or writing these tables
([ADR-0001](decisions/0001-drizzle-with-a-prisma-baseline.md)):

- **Timestamps are integer milliseconds** since the epoch. Drizzle maps them with
  `{ mode: 'timestamp_ms' }`, so application code sees a `Date`. Production held ISO text until the
  `0001` migration converted it; do not reintroduce a text format, because SQLite compares INTEGER
  and TEXT by storage class and a mixed column silently matches nothing.
- **Booleans are integer 0/1**. Drizzle maps them with `{ mode: 'boolean' }`.

## users

A thin mirror of the central NNT identity store ([stage-door](https://github.com/newtheatre/stage-door)).
Ids **are** canonical auth-service ids, upserted from the shared session on every authenticated
request by `ensureLocalUser`.

Credentials, verification and roles live in the auth service. `rooms:ADMIN` rides in the sealed
session and is read from there.

| Column | Notes |
| --- | --- |
| `id` | Canonical auth-service id. Never minted locally. |
| `email` | Unique. Case-sensitive, which is why the migration had to fold case-duplicates. Two auth-service ids can hold one address before a merge, so `ensureLocalUser` mirrors the later one under a placeholder rather than failing ([ADR-0004](decisions/0004-an-email-collision-must-not-break-every-request.md)). |
| `is_rooms_admin` | **A cache, not an authority, and it does not lapse.** Refreshed from the session, but only while that person keeps making authenticated requests, so a grant that expired at handover stays set here for good. The fan-out asks stage-door who holds the role and uses this column only when stage-door cannot be reached ([ADR-0009](decisions/0009-admin-fan-out-asks-stage-door-who-holds-the-role.md)). Never gate access on it. |
| `notification_channels` | JSON array, e.g. `["EMAIL", "PUSH"]`. Unparseable values fall back to `["EMAIL"]`. |
| `notification_preferences` | JSON array, e.g. `["BOOKING_UPDATES"]`. Unparseable values fall back to `["BOOKING_UPDATES"]`. |
| `anonymised_at` | Set by the erasure hook, and by the merge hook on the losing id. While it is non-null the row is never written back over, whichever caller asks. An erased id always keeps a row, because the column can only hold a write off while something carries it ([ADR-0006](decisions/0006-an-erased-id-always-keeps-a-tombstone-row.md)). `server/utils/mirrorUser.ts` is the one write path for the identity columns; `PUT /api/account/preferences` writes the two notification columns and carries the same `IS NULL` predicate, answering **409** when it matches nothing. |

Account-security email ignores both notification columns.

A merge that ran before the tombstone existed deleted the losing row, and a session that outlived
it could then re-create the id with the person's real name and email. Nothing scrubs those rows
now, because the auth service will not send a hook for an id it has already erased. They are
findable, and each one should be checked against the merges in the auth service's audit log and
scrubbed by hand:

```sql
SELECT u.id, u.email, u.created_at FROM users u
WHERE u.anonymised_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = u.id);
```

That lists every mirror row holding no bookings, which is a superset: someone who signed in and
never booked looks the same. The auth service is the authority on which of those ids are erased.

## rooms

Internal rehearsal rooms the theatre controls directly.

`is_active` retires a room without deleting it, so its booking history stays readable. Deleting via
`DELETE /api/rooms/:id` deactivates by default; `?permanent=true` hard-deletes and is refused once
the room has any bookings.

## external_venues

Third-party spaces, organised by campus → building → room. `contact_details` is free text for
whoever has to ring them.

There is no deactivated state, so deletion is permanent and refused outright while any booking
references the venue. Reassign or cancel those bookings first.

## bookings

A request for a space and a window.

**Either `room_id` or `external_venue_id` is set, never both.** Neither is set while the request is
still `PENDING` and unassigned.

`user_id` is nullable with `onDelete: SetNull`, so booking history survives an account being
removed centrally.

### Status lifecycle

```
PENDING ──► CONFIRMED                       an internal room is assigned
        ──► AWAITING_EXTERNAL ──► CONFIRMED  an external venue is being arranged
        ──► REJECTED                         rejection_reason is required and is shown to the requester
```

`CANCELLED` is terminal, and is available to the requester while the booking is `PENDING` or
`CONFIRMED`. A requester who cancels alerts the admins who have opted in, naming the external
venue when there is one, since that arrangement was made by hand.

`REJECTED` and `CANCELLED` are both terminal and enforced as such in
`server/utils/bookingWrites.ts`: a change back out of either is refused with 409, for admins
too. The slot was released and may already belong to someone else, so the booking is made
again rather than reopened.

| Status | Meaning |
| --- | --- |
| `PENDING` | Submitted, not yet triaged. Holds its slot. |
| `CONFIRMED` | Approved, with an internal room or a confirmed external venue. |
| `AWAITING_EXTERNAL` | An external venue has been approached but has not confirmed. Holds its slot. |
| `REJECTED` | Declined, with a reason. |
| `CANCELLED` | Withdrawn by the requester or an admin. |

### Recurrence and the clock

Occurrences are generated on London wall-clock parts, not by stepping a `Date`, so a weekly
rehearsal keeps its time across a BST transition and a weekly pattern selects the days the member
actually picked. The Worker runs in UTC, where `Date`'s local mutators do neither
([ADR-0002](decisions/0002-recurrence-arithmetic-in-europe-london.md)).

A booking's duration is an absolute span: a two-hour rehearsal stays two hours even if the clocks
change during it. Only the start is anchored to the wall clock.

### Occupancy

A space is occupied by bookings in **`CONFIRMED`, `PENDING` or `AWAITING_EXTERNAL`**, a pending
request holds its slot, so two people cannot both be told yes.

`server/utils/availability.ts` is the single implementation of that rule. Intervals are half-open:
a booking ending exactly when another starts is not a conflict. `allowConflicts` is the deliberate
admin override for double-booking.

The rule is asserted twice: once as a `SELECT`, which is what produces the 409 and its list of
clashing bookings, and again as a `NOT EXISTS` predicate on the `UPDATE` itself, because D1 has no
interactive transaction and a `SELECT` on its own cannot hold the slot between the check and the
write ([ADR-0008](decisions/0008-the-occupancy-check-is-re-asserted-in-the-write.md)).

**A window must end after it starts, and the write path is what enforces it.** There is no `CHECK`
on the columns, because SQLite has no `ALTER COLUMN` and adding one means rebuilding the table.
`planBookingChange` refuses any patch that touches either end and leaves `end_time` at or before
`start_time`, which matters because the occupancy predicate is `start_time < :end AND end_time >
:start`: an inverted row can never satisfy it, so it holds no slot and the room reads as free while
its owner believes they have it. To find any that predate the check:

```sql
SELECT id, user_id, start_time, end_time FROM bookings WHERE end_time <= start_time;
```

Each one needs its window corrected or the booking cancelling, by hand.

### Indexes

`(start_time, end_time)` and `(room_id, start_time, end_time)` back the availability queries;
`(parent_booking_id)` backs the recurring-series lookups.

`(user_id, start_time)` backs every member-facing read: `GET /api/bookings/stats` counts four
times over `user_id`, `GET /api/bookings` scopes a non-admin to their own rows, `/requests` walks
every page of that, and the export, anonymise, merge and last-activity hooks all filter the same
column. `(external_venue_id, start_time, end_time)` backs `checkVenueAvailability`, which is the
occupancy gate for every external-venue assignment and is the mirror of the room one.

**SQLite creates no index for a foreign key.** Both columns are foreign keys and both were
unindexed, so those reads were full table scans; bookings are only ever added, and D1 bills by rows
read, so that got worse every term and never better.

## recurring_patterns

Attached to the **parent** (first) booking of a series, one-to-one.

Expansion happens once, at creation: every occurrence becomes its own `bookings` row carrying
`parent_booking_id` and `occurrence_number`. There is no series entity to keep in step; occurrences
are approved, moved and cancelled individually.

| Field | Notes |
| --- | --- |
| `frequency` | `DAILY` (every N days), `WEEKLY` (specific weekdays), `CUSTOM` |
| `interval` | Every N days or weeks |
| `days_of_week` | JSON array for weekly patterns, e.g. `["MON", "WED", "FRI"]` |
| `max_occurrences` | Hard limit 52, about a year of weekly bookings. The UI offers 12, about a term. |
| `end_date` | Alternative to `max_occurrences`; one of the two must be set |

`onDelete: Cascade` from the parent booking, so deleting the series head takes the pattern with it.

`bookings.parent_booking_id` cascades the same way, which means removing the head would remove
every later occurrence. `DELETE /api/bookings/:id` promotes the next occurrence to head the series
before deleting the old one, so the default scope removes exactly one row
([ADR-0003](decisions/0003-deleting-the-head-of-a-recurring-series.md)). `?scope=series` is the
way to remove all of them, and it relies on the cascade deliberately.

The promotion is three statements and the delete is a fourth, and all four go in one `db.batch`.
Half a promotion splits one series into two, and no later `scope=series` delete would then clear
both halves.

`occurrence_number` is not renumbered on promotion: it records which occurrence of the original
pattern a row was, which stays true.

## push_subscriptions

One row per device or browser, keyed on a unique `endpoint`, cascading from the user.

**Nothing sends to these.** `sendPushNotification` in `server/utils/notifications.ts` logs and
returns, so selecting the PUSH channel delivers nothing. The subscribe and unsubscribe endpoints
work; the sender does not exist. See [README.md](../README.md) §Known gaps.
