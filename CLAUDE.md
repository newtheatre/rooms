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
bun run typecheck  # nuxt typecheck — does NOT currently pass, see below
bun run build      # the production Worker bundle
bunx prisma studio # inspect the local database
```

CI gates on lint and build only. There is no test suite.

## Source of truth & docs discipline

- **Code is truth; docs follow it.** A PR that changes behaviour updates the matching doc in the same PR.
- There is no `docs/` directory and no ADRs here. `content/docs/` is **user-facing** guidance published to the site — do not put engineering notes in it. Estate-wide decisions live in stage-door's `docs/decisions/`; anything specific to this app currently has nowhere to go, which is itself worth fixing.
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
10. **Each hook statement binds a fixed number of parameters.** D1 caps at 100 per statement, and this fails in production long after it passes in dev — scope by predicate, never by an id list built from a result set.

## Repo conventions

- **Prisma**, not Drizzle — the one deliberate divergence from the rest of the estate. Migration and schema advice from proscenium, rehearsal and stage-door does not transfer.
- Zod for request bodies and query strings (`server/utils/validation.ts`). One route = one file under `server/api/`.
- Endpoints declare their responses in `defineRouteMeta({ openAPI: … })`. That block is the machine-readable contract — do not duplicate status codes into the file's comment, where they will drift.
- Errors via `createError` — no internal detail in responses.
- Deleting a room deactivates it (`isActive: false`) to keep booking history readable; permanent deletion is refused once bookings exist. External venues have no deactivated state, so their deletion is refused outright.
- British English in UI copy and docs.

## Comments

A comment carries what the code cannot: a constraint, a trap, a contract that is not obvious from the signature. It does not narrate, and it does not argue.

- **State the rule, not the story.** The rule is a comment; the incident that taught it is a decision record.
- **Do not restate the code.** `@param count — Number of rooms selected` says nothing the signature does not, and a "Features:" list in a component header is out of date by the next release. This repo was full of both; do not reintroduce them.
- **Do not restate `defineRouteMeta`.** Response codes belong in the OpenAPI block, once.
- **No unprovenanced figures.** A comment cannot honestly carry a row count, because nothing updates it.
- **Say plainly when something is not implemented**, at the thing that is not implemented — as `sendPushNotification` now does.

One to five lines is the usual size. Past about ten, ask whether you are writing a decision record.

## Things Claude Code should proactively flag

- Any code path that decides availability without going through `server/utils/availability.ts`.
- Any query whose bound-parameter count grows with the number of rows it covers.
- Any reintroduction of credential storage, role editing or password UI.
- A comment that restates a signature, a template, or the OpenAPI block below it.
