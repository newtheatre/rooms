# Data model

The schema is `server/db/schema/`, one file per domain area; this document is the reference that
does not fit in its comments. Drizzle through NuxtHub's `hub:db` layer, as the rest of the estate.

Table names are snake_case, given explicitly to each column; the TypeScript fields are camelCase.

Two storage details are inherited from the Prisma schema these tables were created by, and both
matter when reading or writing them
([ADR-0001](decisions/0001-drizzle-with-a-prisma-baseline.md)):

- **Timestamps are integer milliseconds** since the epoch, declared `DATETIME` in the live DDL.
  Drizzle maps them with `{ mode: 'timestamp_ms' }`, so application code sees a `Date`.
- **Booleans are integer 0/1**, declared `BOOLEAN`. Drizzle maps them with `{ mode: 'boolean' }`.

## users

A thin mirror of the central NNT identity store ([stage-door](https://github.com/newtheatre/stage-door)).
Ids **are** canonical auth-service ids, upserted from the shared session on every authenticated
request by `ensureLocalUser`.

Credentials, verification and roles live in the auth service. `rooms:ADMIN` rides in the sealed
session and is read from there.

| Column | Notes |
| --- | --- |
| `id` | Canonical auth-service id. Never minted locally. |
| `email` | Unique. Case-sensitive, which is why the migration had to fold case-duplicates. |
| `is_rooms_admin` | **A cache, not an authority.** Refreshed from the session on each request and used only to decide who receives admin notification fan-out — a cron has no session to read roles from. Never gate access on it. |
| `notification_channels` | JSON array, e.g. `["EMAIL", "PUSH"]`. Unparseable values fall back to `["EMAIL"]`. |
| `notification_preferences` | JSON array, e.g. `["BOOKING_UPDATES"]`. Unparseable values fall back to `["BOOKING_UPDATES"]`. |

Account-security email ignores both notification columns.

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
`CONFIRMED`.

| Status | Meaning |
| --- | --- |
| `PENDING` | Submitted, not yet triaged. Holds its slot. |
| `CONFIRMED` | Approved, with an internal room or a confirmed external venue. |
| `AWAITING_EXTERNAL` | An external venue has been approached but has not confirmed. Holds its slot. |
| `REJECTED` | Declined, with a reason. |
| `CANCELLED` | Withdrawn by the requester or an admin. |

### Occupancy

A space is occupied by bookings in **`CONFIRMED`, `PENDING` or `AWAITING_EXTERNAL`** — a pending
request holds its slot, so two people cannot both be told yes.

`server/utils/availability.ts` is the single implementation of that rule. Intervals are half-open:
a booking ending exactly when another starts is not a conflict. `allowConflicts` is the deliberate
admin override for double-booking.

### Indexes

`(start_time, end_time)` and `(room_id, start_time, end_time)` back the availability queries;
`(parent_booking_id)` backs the recurring-series lookups.

## recurring_patterns

Attached to the **parent** (first) booking of a series, one-to-one.

Expansion happens once, at creation: every occurrence becomes its own `bookings` row carrying
`parent_booking_id` and `occurrence_number`. There is no series entity to keep in step — occurrences
are approved, moved and cancelled individually.

| Field | Notes |
| --- | --- |
| `frequency` | `DAILY` (every N days), `WEEKLY` (specific weekdays), `CUSTOM` |
| `interval` | Every N days or weeks |
| `days_of_week` | JSON array for weekly patterns, e.g. `["MON", "WED", "FRI"]` |
| `max_occurrences` | Hard limit 52, about a year of weekly bookings. The UI offers 12, about a term. |
| `end_date` | Alternative to `max_occurrences`; one of the two must be set |

`onDelete: Cascade` from the parent booking, so deleting the series head takes the pattern with it.

## push_subscriptions

One row per device or browser, keyed on a unique `endpoint`, cascading from the user.

**Nothing sends to these.** `sendPushNotification` in `server/utils/notifications.ts` logs and
returns, so selecting the PUSH channel delivers nothing. The subscribe and unsubscribe endpoints
work; the sender does not exist. See [README.md](../README.md) §Known gaps.
