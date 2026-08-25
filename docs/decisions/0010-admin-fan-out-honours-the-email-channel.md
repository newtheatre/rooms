# ADR-0010: Admin fan-out honours the email channel

**Status:** Accepted · **Date:** 2026-08-25 · **Deciders:** Matt Adcock (ITM 26/27)

## Context

A mirror row carries two notification columns. `notification_preferences` says which *types* of
message someone wants (`BOOKING_UPDATES`, `ADMIN_NEW_BOOKINGS`); `notification_channels` says
*where* they will take them (`EMAIL`, `PUSH`).

`notifyBookingUpdate` reads both. `notifyAdmins` read only the type, then bcc'd everyone it had
left. An admin who turned the Email switch off on `/settings/notifications` stored
`notification_channels = []`, stopped receiving their own booking mail, and carried on receiving
every new booking request and every member cancellation. The same column governed one class of
mail and was ignored for the other, which is not a distinction anyone was told about: the settings
page heads that section "Where can we notify you?".

`PUT /api/account/preferences` accepts an empty array, and `getNotificationChannels` parses `[]`
successfully, so an admin really can end up with no channel at all. Push delivers nothing here:
`sendPushNotification` logs and returns, and the switch for it is disabled in the UI for that
reason. So "no enabled channel" is silence rather than a different route in.

## Decision

`notifyAdmins` filters on both columns, using `getNotificationChannels` so the fallback to
`['EMAIL']` for an unparseable value is preserved. An admin with `EMAIL` off receives no admin
fan-out.

The channel switch is authoritative, not advisory. Someone who says they do not want email from
this app does not get email from it, and admin fan-out is not important enough to override that: it
is a request for a room, and the person who made it is told separately that it is pending. The
existing `ADMIN_NEW_BOOKINGS` toggle remains the narrower opt-out for an admin who wants other mail
from this app but not this type.

Because that means an admin can now silence themselves completely, `notifyAdmins` logs a warning
when it resolves recipients but none of them are set to take email, so a request nobody was told
about is visible in `wrangler tail` rather than silent. The account-security mail stage-door sends
is unaffected: it ignores both columns, as it always has.

## Consequences

Good: one rule for both classes of mail, and the settings page now describes what actually happens.

Good: an outgoing committee member who wants out of the mail has one switch that works, rather than
one that half works.

Bad: if every admin turns email off, a booking request sits `PENDING` with nobody alerted. That is
the setting being obeyed, and the warning in the log is the only backstop. Restoring push delivery
would give such an admin a channel that works; until then the log line is what a successor has.

Neutral: nothing changes for an admin who has left their settings alone. `EMAIL` is the default,
and an unparseable column still falls back to it.
