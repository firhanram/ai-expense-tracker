# The client supplies the date; the server has no timezone

Every request that creates a Draft Expense or asks for a Report carries the client's local date. The server never derives "today" and holds no timezone configuration.

Expense dates are stored as dates with no time component (ADR-0003's sibling decision), so the only question a timezone could answer is what date a *new* Draft defaults to. Answering it server-side means picking a timezone that is wrong either for the user's location or for the server's. Railway containers run UTC; from 00:00 to 07:00 Jakarta time a UTC-derived default assigns yesterday's date, which is roughly a third of waking hours, and on the first of a month puts the expense in the previous month's Report. The browser already knows the user's local date everywhere they go, so passing it costs one field and is correct without configuration.

## Consequences

- The API trusts the client's date. That is acceptable for a single-user personal app; it would not be for a multiuser one where dates carry financial meaning.
- A request with no client date is a validation error rather than a silent fallback to UTC. A fallback would reintroduce the off-by-one invisibly.
- **Report ranges are always explicit `from`/`to` dates.** The client computes them. The server does no calendar arithmetic, so there is exactly one implementation of "this month" and it lives where the user's clock is.
- The prohibition is on reading the clock, not on date logic. If a named preset is ever added (`range=this_month&today=...`), it remains acceptable because the result is a pure function of the input; it is simply not needed while the client can send the range it already knows.
- A chat turn may also carry `defaultDate`, the date the user picked in the composer. It is what a Draft gets when the sentence names no date; `clientDate` is still what "yesterday" is resolved against. Neither is derived on the server.
- An `occurred_at` later than the client's date is rejected. With the client's date as the only notion of today, the server can enforce this without reading the clock.
- The prohibition covers calendar dates, not timestamps. `created_at` uses the server clock; it records when a row was written and is never used to decide which day an Expense belongs to.
- Background or scheduled work, if ever added, has no server-side notion of "today" and must receive a date explicitly.

## Considered Options

- **`APP_TIMEZONE` env var** (e.g. `Asia/Jakarta`). Correct for one location, wrong when traveling, and reintroduces server-side date derivation.
- **Ignore it, use UTC.** Rejected: silently wrong dates for the hours the user is most likely to record morning expenses.
