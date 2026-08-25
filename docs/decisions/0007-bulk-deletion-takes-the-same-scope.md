# ADR-0007: Bulk deletion takes the same scope as the single route

**Status:** Accepted · **Date:** 2026-08-25 · **Deciders:** Matt Adcock (ITM 26/27) ·
**Extends:** [ADR-0003](0003-deleting-the-head-of-a-recurring-series.md)

## Context

[ADR-0003](0003-deleting-the-head-of-a-recurring-series.md) gave `DELETE /api/bookings/:id` an
explicit scope and made the default promote the next occurrence before removing a head, so the
`ON DELETE cascade` on `bookings.parent_booking_id` cannot take a whole series with it.

`DELETE /api/bookings/bulk` was never given the same treatment. It read the rows, built the
notifications, and then deleted the id list in chunks. An admin who ticked the first occurrence of
a twelve-week series in `/admin/bookings` along with two unrelated bookings destroyed fourteen rows
plus the `recurring_patterns` row, was told "3 booking(s) have been deleted", and the owner's email
named the one occurrence that had been ticked. Eleven confirmed rehearsals left their account
silently and the rooms were never re-offered. The record ADR-0003 left behind reads as though the
class of bug was closed, which is what made this worth writing down rather than quietly patching.

The count was wrong for a second reason as well. SQLite's `RETURNING` reports the rows the
statement deleted, never the rows the cascade took, so nothing in the response could have been
trusted to say how much went; the toast did not even use it, it counted the ticked rows in the
browser.

## Decision

`DELETE /api/bookings/bulk` takes `?scope=occurrence|series`, the same query parameter and the same
`bookingDeleteQuerySchema` as the single route, defaulting to `occurrence`.

`scope=occurrence` deletes the listed rows and nothing else. The ids are handled one at a time,
each promoting its successor immediately before its own delete. The promotion cannot be a pre-pass
over the whole list: promoting a head hands the series to its successor, so a later chunked delete
that happened to include that successor would cascade into everything the promotion just saved.

`scope=series` resolves each listed id to its series parent, deduplicates the parents, and deletes
those heads, letting the cascade do the work as ADR-0003 intended.

The response's `deleted` counts the rows resolved before the delete, not the rows a statement
reported, and the admin page prints that number rather than counting the ticked rows itself.
Notifications are built from the same resolved set, so a series cancellation names every occurrence
it takes.

## Alternatives considered

**Expand the ids in the client and keep the endpoint as it is.** Rejected for the reason the
single route was moved off that approach: the admin table filters and pages in the browser, so the
client's idea of a series is whatever it has loaded.

**Refuse a selection containing a series head.** It would have been safe, but it makes exactly one
row of the table undeletable for reasons no admin could infer, which ADR-0003 already rejected.

## Consequences

Good: the two delete routes now behave the same way, and neither can take a series by accident.

Bad: `scope=occurrence` costs a round trip or two per id rather than one per chunk. The body is
capped at 100 ids, and each statement binds a fixed number of parameters, so D1's cap is not in
play; the request is simply slower than it was when it was wrong.

Neutral: `scope=series` may remove occurrences nobody ticked, which is the point of asking for it.
The count and the notifications describe what actually went.
