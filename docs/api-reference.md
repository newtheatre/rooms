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

`rooms:ADMIN` is the only role this app owns. Being signed in is enough to request a booking.

## Bookings

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/bookings` | session | Admins see all; a STANDARD user sees only their own, scoped server-side rather than by a query parameter. Filters: `status`, `startDate`, `endDate`, `roomId`. |
| `POST /api/bookings` | session | Create a request. See below. |
| `GET /api/bookings/:id` | owner or admin | One booking with its relations. |
| `PUT /api/bookings/:id` | owner or admin | Field set depends on role. See below. |
| `DELETE /api/bookings/:id` | owner or admin | Deletes and notifies the owner. |
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
| `recurringPattern` | anyone | `{ frequency, interval, daysOfWeek, maxOccurrences, endDate }` — expands to one booking row per occurrence, each availability-checked before any row is written |
| `userId` | admin | Book on behalf of someone |
| `roomId` / `externalVenueId` | admin | Assign a space at creation |
| `status` | admin | Override the initial status |

Admins are notified of anything left `PENDING`, as one batched email rather than one per admin.

### `PUT /api/bookings/:id`

The two roles are validated against different schemas.

- **Admin** — `roomId`, `externalVenueId`, `status`, `rejectionReason`, `allowConflicts`.
- **Owner, `PENDING` only** — `eventTitle`, `numberOfAttendees`, `startTime`, `endTime`, `notes`.
- **Owner, `PENDING` or `CONFIRMED`** — `status: "CANCELLED"`, the only status an owner may set.

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
| `PUT /api/rooms/:id` | admin | Partial body. |
| `DELETE /api/rooms/:id` | admin | Deactivates by default. `?permanent=true` hard-deletes, and is refused once the room has bookings. |
| `GET /api/rooms/available` | session | Required: `startTime`, `endTime`. `excludeBookingId` omits a booking's own rows so editing it does not conflict with itself. |

## Venues

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/venues` | session | Admins also get creation dates and booking counts. Filters: `campus`, `building`. |
| `POST /api/venues` | admin | |
| `GET /api/venues/:id` | admin | |
| `PUT /api/venues/:id` | admin | Partial body. |
| `DELETE /api/venues/:id` | admin | Permanent, and refused while any booking references the venue — unlike rooms there is no deactivated state. |

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

**Nothing sends to push subscriptions.** `sendPushNotification` is a stub — see
[data-model.md](data-model.md#push_subscriptions).

## Inbound GDPR hooks

Called by the auth service, authenticated by hashed service token. All are idempotent, because
stage-door retries them until they succeed.

| Route | Effect |
| --- | --- |
| `POST /api/_hooks/auth/export` | `{ userId }` → this app's personal data: the mirror row and their bookings |
| `POST /api/_hooks/auth/anonymise` | Scrubs the mirror row. Bookings survive as anonymous rows. |
| `POST /api/_hooks/auth/last-activity` | `{ userIds }` → latest booking activity per user. Chunks its `in` clause at 90 ids, because D1 caps bound parameters at 100. |
| `POST /api/_hooks/auth/merge` | `{ fromUserId, toUserId, dryRun? }` → re-points bookings and push subscriptions onto the winner, deletes the losing mirror row. Each statement binds two parameters however many rows move, so no chunking is needed here. The winner's own preferences are untouched. (stage-door ADR-0015) |
| `GET /api/_hooks/auth/manifest` | This app's declaration: namespace, the roles it reads, and the permissions each carries. The auth service polls it and turns the roles into definitions, so adding a role here is what makes it grantable (stage-door ADR-0017). |

The manifest is `shared/utils/appManifest.ts`, served verbatim. `rooms:ADMIN` is still the only role
this app owns, but the four things it actually gates are now named rather than inferred:
`admin.access`, `booking.read.any`, `booking.manage.any` and `room.read.inactive`. That distinction
matters at the sites that redact a field rather than refuse a request, such as the booked-by name in
`GET /api/rooms/available`. Every check now names one of them rather than the role that implies it.

Permissions are lowercase and dotted where roles are uppercase, so no string can be read as both.

## Other

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | public | `{ ok: true }` |
| `GET /dev-login` | dev only | Seals a fake session. `?admin=1` grants `rooms:ADMIN`. Guarded by `import.meta.dev`, so it does not exist in a production build. The single sanctioned exception to "this app never writes the session". |
