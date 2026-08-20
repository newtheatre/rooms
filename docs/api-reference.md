# API reference

Every route under `server/api/`. Response codes are also declared in each handler's
`defineRouteMeta({ openAPI: … })` block, which is the machine-readable contract; this document
carries the behaviour that block cannot express.

## Auth

| Helper | Effect |
| --- | --- |
| `requireAuth(event)` | 401 unless there is a valid session |
| `requireAdmin(event)` | 401 unless signed in; **401 with `{ stale: true }`** if the session's roles are older than 15 minutes, which the client middleware turns into a refresh; 403 unless the session carries `rooms:ADMIN` |
| `requireHookAuth(event)` | Bearer must be the SHA-256 of this app's service token. Used only by the `_hooks` routes, which the auth service calls. |
| `canNow(event, permission)` | A permission claim, staleness-checked on the same 15-minute rule as `requireAdmin`. Someone who does not hold the permission gets `false`, not a refresh prompt. |

**Every permission claim is staleness-checked**, whether the route guards itself with
`requireAdmin` or asks `canNow` for one permission. A role revoked centrally stops working within
15 minutes on every route, rather than only on the ones that happened to use `requireAdmin`.

`rooms:ADMIN` is the only role this app owns. Being signed in is enough to request a booking.

## Pagination

`GET /api/bookings`, `/api/rooms`, `/api/venues` and `/api/users` page in SQL and return an
envelope, never a bare array:

```json
{ "items": [ ... ], "total": 412, "limit": 50, "offset": 0 }
```

`limit` defaults to 50 and is capped at 200; `offset` defaults to 0. `total` is the count the
filter matches, not the page length.

`GET /api/bookings/stats` returns `{ total, pending, confirmed, upcoming }` for the signed-in
user, so a caller that only wants counts does not fetch rows to count them.

Every request body **and every query string** is validated with Zod, from
`server/utils/validation.ts`. A bad filter value is a 400 naming the field, not a cast that
silently becomes `NaN`. An update body carrying no fields at all is also a 400, rather than
reaching the ORM and surfacing as a 500.

## Bookings

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/bookings` | session | Admins see all; a STANDARD user sees only their own, scoped server-side rather than by a query parameter. Filters: `status`, `startDate`, `endDate`, `roomId`. |
| `POST /api/bookings` | session | Create a request. See below. |
| `GET /api/bookings/stats` | session | Counts for the caller's own bookings. |
| `GET /api/bookings/:id` | owner or admin | One booking with its relations. |
| `PUT /api/bookings/:id` | owner or admin | Field set depends on role. See below. `?scope=series` applies an admin's change to every unfinished occurrence. |
| `DELETE /api/bookings/:id` | owner or admin | Deletes and notifies the owner. `?scope=series` removes the whole recurring series; the default `occurrence` removes one and promotes the next to head it ([ADR-0003](decisions/0003-deleting-the-head-of-a-recurring-series.md)). |
| `PUT /api/bookings/bulk` | admin | `{ updates: [{ id, data }] }`, where `data` is the admin shape below. Same schema and same occupancy check as the single-row route. |
| `DELETE /api/bookings/bulk` | admin | `{ bookingIds: number[] }`. |

Both bulk routes group notifications by user, so someone whose five bookings all move gets one
email rather than five.

### `POST /api/bookings`

| Field | Who | Notes |
| --- | --- | --- |
| `eventTitle` | anyone | Required |
| `startTime`, `endTime` | anyone | ISO 8601. Required. |
| `numberOfAttendees`, `notes` | anyone | Optional |
| `recurringPattern` | anyone | `{ frequency, interval, daysOfWeek, maxOccurrences, endDate }`, expands to one booking row per occurrence, each availability-checked before any row is written |
| `userId` | admin | Book on behalf of someone |
| `roomId` / `externalVenueId` | admin | Assign a space at creation |
| `status` | admin | Override the initial status |

Admins are notified of anything left `PENDING`, as one batched email rather than one per admin.

### `PUT /api/bookings/:id`

The two roles are validated against different schemas.

- **Admin**: `roomId`, `externalVenueId`, `status`, `rejectionReason`, `allowConflicts`, plus the schedule fields `eventTitle`, `numberOfAttendees`, `startTime`, `endTime` and `notes`.
- **Owner, `PENDING` only**: `eventTitle`, `numberOfAttendees`, `startTime`, `endTime`, `notes`.
- **Owner, `PENDING` or `CONFIRMED`**: `status: "CANCELLED"`, the only status an owner may set.

Moving a booking is an admin action: changing `startTime` or `endTime` re-checks occupancy for
the new window, so a move onto an occupied slot is a 409 like any other clash. This is what makes
"occurrences are moved one at a time" possible at all.

An owner may cancel a confirmed slot but not edit one: giving the room back is theirs to
decide, moving it is not. Every owner cancellation alerts the admins who have opted in, and
names the external venue when there is one, because that booking was arranged by hand and
someone has to unarrange it.

A status change made by an admin notifies the owner, subject to their preferences.

`REJECTED` and `CANCELLED` are terminal. Any change back out of them is refused with **409**,
whoever asks: a released slot may have been given to someone else, so the booking has to be
made again rather than reopened.

Every write goes through `applyBookingChange` in `server/utils/bookingWrites.ts`, which
re-checks occupancy for the booking as it will be *after* the patch. A change that would
double-book returns **409** with the clashing bookings in `data.conflicts`. `allowConflicts: true`
is the deliberate admin override and is the only way to write a clash.

A booking moving to `REJECTED` or `CANCELLED` holds nothing, so it is never blocked.

## Rooms

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/rooms` | session | Admins get every column plus booking counts and may pass `includeInactive=true`; everyone else gets the public fields for active rooms only. |
| `POST /api/rooms` | admin | |
| `GET /api/rooms/:id` | admin | |
| `PUT /api/rooms/:id` | admin | Partial body, at least one field. Omitting `isActive` leaves it alone rather than reactivating the room. |
| `DELETE /api/rooms/:id` | admin | Deactivates by default. `?permanent=true` hard-deletes, and is refused once the room has bookings. |
| `GET /api/rooms/available` | session | Required: `startTime`, `endTime`, both ISO 8601 and validated. `excludeBookingId` omits a booking's own rows so editing it does not conflict with itself. |

## Venues

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/venues` | session | Admins also get creation dates and booking counts. Filters: `campus`, `building`. |
| `POST /api/venues` | admin | |
| `GET /api/venues/:id` | admin | |
| `PUT /api/venues/:id` | admin | Partial body, at least one field. |
| `DELETE /api/venues/:id` | admin | Permanent, and refused while any booking references the venue; unlike rooms there is no deactivated state. |

## Users

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/users` | admin | The local mirror, not the auth service. `search` matches name and email. |
| `GET /api/users/:id` | admin | One mirror row with their bookings. |
| `POST /api/users` | admin | Asks the auth service for a shadow account by email (match-or-create, service-token authenticated) and mirrors the canonical id. No passwords are generated; the person claims the account later. |

## Account

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/account/preferences` | session | Channels and types, parsed from their JSON columns. |
| `PUT /api/account/preferences` | session | Account-security mail ignores both. |
| `POST /api/notifications/subscribe` | session | Registers a Web Push subscription, keyed on the unique `endpoint`. |
| `POST /api/notifications/unsubscribe` | session | By endpoint; the caller may only remove their own. |

**Nothing sends to push subscriptions.** `sendPushNotification` is a stub. See
[data-model.md](data-model.md#push_subscriptions).

## Inbound GDPR hooks

Called by the auth service, authenticated by hashed service token. All are idempotent, because
stage-door retries them until they succeed.

| Route | Effect |
| --- | --- |
| `POST /api/_hooks/auth/export` | `{ userId }` → this app's personal data: the mirror row and their bookings, including `notes` and `rejectionReason` |
| `POST /api/_hooks/auth/anonymise` | Scrubs the mirror row and every free-text field on their bookings. Bookings survive as anonymous rows. Scrub list below. |
| `POST /api/_hooks/auth/last-activity` | `{ userIds }` → latest booking activity per user. Chunks its `in` clause at 90 ids, because D1 caps bound parameters at 100. |
| `POST /api/_hooks/auth/merge` | `{ fromUserId, toUserId, dryRun? }` → re-points bookings and push subscriptions onto the winner, deletes the losing mirror row. Each statement binds two parameters however many rows move, so no chunking is needed here. The winner's own preferences are untouched. (stage-door ADR-0015) |
| `GET /api/_hooks/auth/manifest` | This app's declaration: namespace, the roles it reads, and the permissions each carries. The auth service polls it and turns the roles into definitions, so adding a role here is what makes it grantable (stage-door ADR-0017). |

### What erasure scrubs

The hook is idempotent, because stage-door retries it until it succeeds.

| Table | Columns |
| --- | --- |
| `users` | `email` becomes `deleted-<id>@anonymised.invalid`, `name` becomes "Deleted user", `is_rooms_admin` cleared, both notification columns emptied, `anonymised_at` stamped |
| `bookings` | `notes` and `rejection_reason` nulled. Everything else survives, so booking statistics do. |
| `push_subscriptions` | Rows deleted outright |

`rejection_reason` is admin-written free text about the requester, so it is scrubbed with the
notes and is returned by the export hook.

`anonymised_at` is what stops the scrub being undone. A sealed session stays readable after
erasure, and every authenticated request upserts the mirror; the upsert skips a row carrying that
column, so the erased details are not written back ([ADR-0005](decisions/0005-an-erased-user-is-never-written-back-over.md)).

The manifest is `shared/utils/appManifest.ts`, served verbatim. `rooms:ADMIN` is still the only role
this app owns, but the four things it actually gates are now named rather than inferred:
`admin.access`, `booking.read.any`, `booking.manage.any` and `room.read.inactive`. That distinction
matters at the sites that redact a field rather than refuse a request, such as the booked-by name in
`GET /api/rooms/available`. Every check now names one of them rather than the role that implies it.

Permissions are lowercase and dotted where roles are uppercase, so no string can be read as both.

## Other

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | public | `{ ok: true }`, or **503** with `{ ok: false, pendingMigrations }`. See below. |
| `GET /dev-login` | dev only | Seals a fake session. `?admin=1` grants `rooms:ADMIN`. Guarded by `import.meta.dev`, so it does not exist in a production build. The single sanctioned exception to "this app never writes the session". |

### `GET /api/health`

Not a plain liveness probe. It compares the migration journal against production's
`_hub_migrations` ledger and returns **503** naming the files that have not been applied, because
a Worker deployed ahead of its schema is the failure stage-door ADR-0021 exists for.

An uptime monitor pointed at this will alarm on a missed migration, which is the intent.
