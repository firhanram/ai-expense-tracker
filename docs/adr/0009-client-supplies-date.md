# The client supplies the date; the server has no timezone

Every request that creates a Draft Expense or asks for a Report carries the client's local date. The server never derives "today" and holds no timezone configuration.

Expense dates are stored as dates with no time component (ADR-0003's sibling decision), so the only question a timezone could answer is what date a *new* Draft defaults to. Answering it server-side means picking a timezone that is wrong either for the user's location or for the server's. Railway containers run UTC; from 00:00 to 07:00 Jakarta time a UTC-derived default assigns yesterday's date, which is roughly a third of waking hours, and on the first of a month puts the expense in the previous month's Report. The browser already knows the user's local date everywhere they go, so passing it costs one field and is correct without configuration.

## Consequences

- The API trusts the client's date. That is acceptable for a single-user personal app; it would not be for a multiuser one where dates carry financial meaning.
- A request with no client date is a validation error rather than a silent fallback to UTC. A fallback would reintroduce the off-by-one invisibly.
- **The server may do calendar arithmetic on the supplied date.** The prohibition is on reading the clock, not on date logic: `range=this_month&today=2026-11-24` is fine, because the result is a pure function of the input. This keeps the definition of "this month" and "last 30 days" in one place instead of duplicating it per client.
- Report requests accept either a named range with `today`, or an explicit `from`/`to` pair which bypasses the presets.
- Background or scheduled work, if ever added, has no server-side notion of "today" and must receive a date explicitly.

## Considered Options

- **`APP_TIMEZONE` env var** (e.g. `Asia/Jakarta`). Correct for one location, wrong when traveling, and reintroduces server-side date derivation.
- **Ignore it, use UTC.** Rejected: silently wrong dates for the hours the user is most likely to record morning expenses.
