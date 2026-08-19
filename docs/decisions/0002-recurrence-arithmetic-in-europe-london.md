# ADR-0002: Do recurrence arithmetic in Europe/London, not the runtime zone

**Status:** Accepted · **Date:** 2026-08-19 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

`generateRecurringOccurrences` expanded a pattern using `Date`'s local mutators: `setDate` to
step a day or a week, `setHours` to carry the start time onto each occurrence, and `getDay` to
decide whether a date matched a selected weekday.

Those mutators operate in whatever zone the runtime is set to. A developer machine in the UK runs
`TZ=Europe/London`, so they behave correctly and the tests a person does by hand all pass. The
Cloudflare Worker runs in UTC, where they do not.

Two failures followed, both of which wrote wrong rows rather than merely displaying them wrongly.

**Occurrences drifted an hour across a clock change.** `setDate(+7)` adds exactly 168 hours, and
`setHours` writes a UTC hour. A weekly Tuesday 19:00 rehearsal booked from 6 October 2026 stored
its first three occurrences at 19:00 London and every occurrence after the 25 October transition
at 18:00 London.

**Weekly patterns could land on the wrong day entirely.** `getDay` reads the UTC weekday. A
booking at 00:30 on Monday 13 July is stored as `2026-07-12T23:30:00Z`, which is a Sunday in UTC.
A `['MON']` pattern generated from it produced four occurrences, every one of them on a Tuesday.

The estate rule already covered the display half of this ("Dates are formatted with `Europe/London`
pinned"), but the rule was written about formatters and this is arithmetic.

## Decision

Recurrence arithmetic is done on **London wall-clock parts**, never on a `Date` via its local
mutators.

`server/utils/london.ts` holds the four operations needed:

- `londonParts(instant)` reads an instant as London year, month, day, hour and minute.
- `fromLondonParts(parts)` returns the instant at which London's clock reads those parts.
- `addLondonDays(parts, n)` steps the civil date, done in UTC where every day is 24 hours long.
- `londonWeekday(parts)` gives the weekday of the civil date.

The generator holds a cursor of London parts and carries the base booking's hour and minute onto
each occurrence, so 19:00 stays 19:00 whichever side of a transition the occurrence falls.

`fromLondonParts` resolves twice. The offset that applies is the one at the answer, not the one at
the first guess, and those differ for any instant near a transition.

A booking's **duration** stays an absolute number of milliseconds. A two-hour rehearsal is two
hours even if the clocks change during it. Only the start is anchored to the wall clock.

## Consequences

Good: a term of Tuesday rehearsals is at the same time every week, which is what everyone booking
one assumes. A weekly pattern selects the days the member actually picked.

Good: the same helpers are available for any future date arithmetic, and the client has a matching
pair in `app/utils/index.ts` for the booking form, which had the mirror-image bug (it read the date
in UTC and the time in the browser's zone, so a booking just after midnight was shown, and re-saved,
a day early).

Bad: two implementations of the offset trick, one server-side and one client-side, because the
client cannot import from `server/`. They are small and each is commented, but they are a pair and
a change to one wants a change to the other.

Bad: `fromLondonParts` is called more than strictly necessary during generation. At the 52
occurrence ceiling this is irrelevant, and clarity was worth more than the arithmetic.

Not addressed: an occurrence landing in the hour that does not exist on a spring-forward Sunday
resolves to the equivalent instant rather than being rejected. Nobody books a rehearsal at 01:30
on the last Sunday in March, and refusing it would be a worse surprise than moving it.
