# Rooms — NNT Rehearsal Room Booking

Rehearsal room booking for the Nottingham New Theatre. Members request a room and a window;
committee admins assign an internal room, arrange an external venue, or reject with a reason.

**Live at:** `rooms.newtheatre.org.uk` · **Owner:** IT Manager / Archivist · **Auth:** shared NNT
sign-on via [stage-door](https://github.com/newtheatre/stage-door) — this app never writes the
session.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Nuxt 4, Vue 3, Nuxt UI 4 |
| Server runtime | Nitro on `cloudflare_module` — a Cloudflare Worker, not Node |
| Database | SQLite: a local file in development, Cloudflare D1 in production |
| ORM | Drizzle, via NuxtHub's `hub:db` layer |
| Auth | `nuxt-auth-utils`, reading the estate's sealed `nnt-session` cookie |
| Email | Resend |
| Content | `@nuxt/content` v3 for the user guides under `content/docs/` |

This app used Prisma until 2026-08-18; it now matches the rest of the estate
([proscenium](https://github.com/newtheatre/proscenium), stage-door, rehearsal). The existing
production tables were kept as they were rather than rebuilt, which is worth understanding before
you touch a migration: [ADR-0001](docs/decisions/0001-drizzle-with-a-prisma-baseline.md).

## Quick start

This project uses **Bun** — `bun.lock` is the only lockfile.

```bash
git clone https://github.com/newtheatre/rooms && cd rooms
bun install
cp .env.example .env      # fill in per the comments in that file
bun run dev               # http://localhost:3000
```

There is no auth service running locally, so sign in with `/dev-login` (an ordinary member) or
`/dev-login?admin=1` (`rooms:ADMIN`). That route is guarded by `import.meta.dev` and does not exist
in a production build.

## How booking works

A request moves through one of three paths, all driven from `/admin/bookings`:

```
PENDING ──► CONFIRMED                      an internal room is assigned
        ──► AWAITING_EXTERNAL ──► CONFIRMED  an external venue is being arranged
        ──► REJECTED                        with a reason, shown to the requester
```

`CANCELLED` is terminal and available to the requester while a booking is `PENDING` or `CONFIRMED`.

A space is considered occupied by bookings in `CONFIRMED`, `PENDING` or `AWAITING_EXTERNAL` — a
pending request holds its slot, so two people cannot both be told yes
(`server/utils/availability.ts`). Admins can override a conflict deliberately.

Recurring requests expand to one booking row per occurrence at creation. There is no series entity:
occurrences are approved, moved and cancelled individually.

## Auth and roles

The estate's sealed `nnt-session` cookie is written only by `auth.newtheatre.org.uk`; this app reads
it with `getUserSession()`. `rooms:ADMIN` is the only role this app owns — being signed in is
enough to make a booking request.

`shared/utils/nntAuth.ts` is a **verbatim copy** of stage-door's `packages/auth-types/index.ts`.
Do not edit it here: change it there and re-copy to all three consumer apps.

Full integration story: stage-door `docs/integrating-an-app.md`.

## Commands

```bash
bun run dev        # local dev server
bun run lint       # eslint
bun run typecheck  # nuxt typecheck — one known error, see below
bun run build      # the production Worker bundle
bun run db:generate # generate a migration from schema changes (review the SQL!)
bun run db:migrate  # apply migrations to the local database
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint and build on every push and PR.
Cloudflare Workers Builds deploys `main`; deployment is not CI's job.

## Known gaps

Recorded here rather than left to be discovered:

- **There are no tests**, and no test harness. proscenium is in the same position; rehearsal and
  stage-door are not.
- **Web push is not implemented.** `/api/notifications/subscribe` records a subscription and the
  settings page offers the PUSH channel, but `sendPushNotification` logs and returns
  (`server/utils/notifications.ts`). Selecting PUSH delivers nothing.
- **`getAvailableRooms` and `getAvailableVenues` query per space**, so listing availability across
  N rooms costs N+1 queries. Correct, but wasteful on D1, which bills per query.

**`bun run typecheck` reports exactly one error**, down from sixteen. It is in
`shared/utils/nntAuth.ts`, on its `declare module '#auth-utils'`, and it is an artefact of that
being the only file in `shared/`: nothing there imports anything, so TypeScript never resolves
`#auth-utils` in the shared project and rejects the augmentation. proscenium carries a
byte-identical copy and passes, because its shared files import `#imports`.

The file is a verbatim copy of stage-door's `packages/auth-types` and must not be edited here, so
this stays until either that package is published or something else lands in `shared/`. CI gates on
lint and build, both of which pass.

Note that `content/docs/` is **user-facing** guidance published to the site. Engineering
documentation lives in [`docs/`](docs/).

## Documentation

| Doc | Read it when… |
| --- | --- |
| [docs/data-model.md](docs/data-model.md) | you're changing the schema, or need the booking status lifecycle |
| [docs/api-reference.md](docs/api-reference.md) | you're calling or changing an endpoint |
| [docs/decisions/](docs/decisions/) | you're about to ask "why on earth is it done this way?" |
| stage-door `docs/integrating-an-app.md` | you're touching anything to do with sessions, roles or the GDPR hooks |

## Comments

A comment carries what the code cannot: a constraint, a trap, a contract that is not obvious from
the signature. It does not narrate, and it does not restate the signature. Anything needing a
paragraph of justification belongs in a decision record, not a header. See
[CLAUDE.md](CLAUDE.md) §Comments.
