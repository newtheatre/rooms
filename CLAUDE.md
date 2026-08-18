# CLAUDE.md — working on newtheatre/rooms

Guidance for Claude Code sessions in this repo. A human (usually the NNT IT Manager) reviews everything; write code and docs they can hand to a successor.

## What this is

Rehearsal room booking for the Nottingham New Theatre, at `rooms.newtheatre.org.uk`. Members request a room and a window; committee admins assign an internal room, arrange an external venue, or reject with a reason. It is a consumer of the estate's shared sign-on and never writes the session.

This is the least-maintained repo in the estate. Read [README.md](README.md) §Known gaps before assuming a check passes or a feature works.

## Commands

```bash
bun install        # deps (Bun is the package manager — bun.lock is the only lockfile)
bun run dev        # local dev server on :3000
bun run lint       # eslint
bun run typecheck  # nuxt typecheck
bun run build      # the production Worker bundle
bun run db:generate # generate a migration from schema changes (review the SQL!)
bun run db:migrate  # apply migrations to the local database
```

CI gates on lint and build. There is no test suite. `typecheck` now passes and is worth running.

## Source of truth & docs discipline

- **Code is truth; docs follow it.** A PR that changes behaviour updates the matching doc in the same PR.
- Engineering docs live in [`docs/`](docs/) — the data model and the API reference. `content/docs/` is **user-facing** guidance published to the site; do not put engineering notes in it.
- Decision records live in [`docs/decisions/`](docs/decisions/). Estate-wide decisions live in stage-door's `docs/decisions/`.
- Cross-app behaviour (sessions, roles, GDPR hooks, shadow accounts) is documented in stage-door: `docs/integrating-an-app.md`, `docs/session-contract.md`.

## Invariants — do not break these

1. **This app never writes the session.** `getUserSession()` is read-only; the sealed `nnt-session` cookie belongs to stage-door. Sole exception: `server/routes/dev-login.get.ts`, guarded by `import.meta.dev`. Use `replaceUserSession` there, never `setUserSession` — the latter merges, and `defu` concatenates arrays, so signing in as a plain user on top of an admin session keeps the admin roles.
2. **`shared/utils/nntAuth.ts` is a verbatim copy** of stage-door's `packages/auth-types/index.ts`. Never edit it here; change the source and re-copy to all three consumer apps.
3. **`rooms:ADMIN` is the only role this app owns.** Being signed in is enough to request a booking. No credential storage, no role editing, no password UI — that is all the auth service's.
4. **A pending request holds its slot.** Availability counts `CONFIRMED`, `PENDING` and `AWAITING_EXTERNAL`, so two people cannot both be told yes. `server/utils/availability.ts` is the single implementation; `allowConflicts` is the deliberate admin override.
5. **Recurring bookings are individual rows.** There is no series entity — occurrences are approved, moved and cancelled one at a time.
6. **`server/plugins/0.secrets-store.ts` keeps its `0.` prefix.** It must run before any plugin reads a session, or the isolate memoises an empty session password, permanently and silently (stage-door ADR-0016).
7. **The `NUXT_` prefix on `NUXT_AUTH_SERVICE_TOKEN` is load-bearing.** Nuxt only maps `NUXT_*` env onto `runtimeConfig`; a worker secret named `AUTH_SERVICE_TOKEN` is silently ignored.
8. **Batch email BCCs.** `sendBatchEmail` puts recipients in `bcc` so an admin list is not disclosed to every admin. Do not "simplify" it back to `to`.
9. **Erasure is anonymisation.** The GDPR hooks under `server/api/_hooks/auth/` are called by stage-door; they scrub this app's share and are idempotent because stage-door retries them.
10. **Each statement binds a fixed number of parameters.** D1 caps at 100 per statement, and this fails in production long after it passes in dev — scope by predicate, never by an id list built from a result set. Where a list is unavoidable, `chunkedByIds` in `server/utils/db.ts` is the one implementation.
11. **Booking responses carry an allow-listed user**, never the whole mirror row, which also holds notification settings. `server/utils/bookingQueries.ts` is the single shape ([ADR-0001](docs/decisions/0001-drizzle-with-a-prisma-baseline.md)).

## Repo conventions

- **Drizzle via NuxtHub**, as the rest of the estate. `import { db, schema } from '@nuxthub/db'`; schema in `server/db/schema/`, migrations in `server/db/migrations/sqlite/`.
- Zod for request bodies and query strings (`server/utils/validation.ts`). One route = one file under `server/api/`.
- Endpoints declare their responses in `defineRouteMeta({ openAPI: … })`. That block is the machine-readable contract — do not duplicate status codes into the file's comment, where they will drift.
- Errors via `createError` — no internal detail in responses.
- Deleting a room deactivates it (`isActive: false`) to keep booking history readable; permanent deletion is refused once bookings exist. External venues have no deactivated state, so their deletion is refused outright.
- British English in UI copy and docs.

## Comments

Enforced by `bun run check:comments`, which CI runs. There are no exemptions.

1. **Two lines of text, maximum.** Delimiters do not count. Most comments should
   be a few words. Past two lines you are writing a doc, not a comment.
2. **Route headers are one line: what it does.** The method and path are the
   filename, and the auth is the guard on the line below.
3. **No JSDoc block tags.** No `@param`, `@returns`, `@props`, `@emits`,
   `@route`, `@example`. The signature and the types already say it.
4. **No narrated history.** Not "used to", "originally", "an earlier version".
   The rule is a comment; the incident that taught it is a decision record.
5. **No figures a comment cannot keep true.** Row counts and percentages go in
   `docs/`, dated, where something updates them.

Anything that does not fit has somewhere to go:

| What it is | Where it goes |
| --- | --- |
| A reason that needs a paragraph | a decision record in `docs/decisions/` |
| An enum, a lifecycle, a column list | `docs/` — the data model or API reference |
| An endpoint's full contract | `docs/` — the API reference |
| A trap that would cost someone an evening | a decision record, cited from a one-line comment |

The comment then states the constraint and cites where the argument lives:
```
// ⚠️ The `0.` prefix is load-bearing (stage-door ADR-0016).
```

## Things Claude Code should proactively flag

- Any code path that decides availability without going through `server/utils/availability.ts`.
- Any customer-facing response built without a column allow-list.
- Any query whose bound-parameter count grows with the number of rows it covers.
- Any reintroduction of credential storage, role editing or password UI.
- A comment that restates a signature, a template, or the OpenAPI block below it.
