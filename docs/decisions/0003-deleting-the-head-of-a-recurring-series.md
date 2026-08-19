# ADR-0003: Deleting the head of a recurring series promotes its successor

**Status:** Accepted · **Date:** 2026-08-19 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

`bookings.parent_booking_id` self-references with `ON DELETE cascade`. Every occurrence after the
first carries the first occurrence's id, so deleting the first occurrence deleted the entire
series.

The admin UI made this easy to hit without meaning to. `RecurringActionModal` offers "Apply to all
eligible bookings", and unticking it says "Will affect 1 booking only". Unticking it and deleting
the first occurrence of a twelve-week series removed all twelve. The owner received one
cancellation email naming one booking, eleven confirmed slots disappeared from their account with
no notification, and the freed rooms were never re-offered.

The requester could do the same to their own series from `/requests`.

This contradicts the invariant that occurrences are approved, moved and cancelled one at a time.

## Decision

Deleting a booking takes an explicit **scope**, and the two cases are handled differently.

`scope=occurrence`, the default, removes exactly one row. When that row is the head of a series,
the next occurrence is promoted first: it is detached from the old head, its siblings are
re-pointed at it, and the `recurring_patterns` row moves onto it. Only then is the old head
deleted, so the cascade finds nothing to take.

`scope=series` removes every occurrence. It does so by deleting the head and letting the cascade
do the work, which is one statement rather than one per row.

The scope is explicit rather than inferred. A caller that says nothing gets the safe behaviour, and
the destructive one has to be asked for.

## Alternatives considered

**Change the foreign key to `ON DELETE SET NULL`.** Orphaned occurrences would survive as
standalone bookings. Rejected: it needs a migration, and it silently breaks "apply to all
occurrences", because the surviving rows would no longer be findable as a series.

**Refuse to delete a head.** Safest, but it makes the first occurrence of every series
undeletable without a separate flow, and "affect 1 booking only" would have to be greyed out on
exactly one row of the table for reasons no user could infer.

## Consequences

Good: the cascade stays, so `scope=series` remains a single statement, and no migration was
needed.

Good: the promotion is three statements with a fixed parameter count each, whatever the length of
the series, so D1's hundred-parameter cap is not in play.

Bad: promotion is not atomic. D1 has no interactive transactions, and `db.batch` cannot express
"detach, then re-point at the row just detached". A failure between the statements leaves the
series split, with some occurrences pointing at a row that no longer heads them. The rows all
survive, which is the important part, and the operator sees an error rather than silence.

Bad: `occurrence_number` is not renumbered on promotion, so a series whose first occurrence was
deleted starts at 2. Renumbering would rewrite every row, and the number records which occurrence
of the original pattern this was, which stays true.
