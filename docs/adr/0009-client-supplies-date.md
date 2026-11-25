# The client supplies the date; the server has no timezone

Every request that creates a Draft Expense or asks for a Report carries the client's local date. The server never derives "today" and holds no timezone configuration.

Expense dates are stored as dates with no time component (ADR-0003's sibling decision), so the only question a timezone could answer is what date a *new* Draft defaults to. Answering it server-side means picking a timezone that is wrong either for the user's location or for the server's. Railway containers run UTC; from 00:00 to 07:00 Jakarta time a UTC-derived default assigns yesterday's date, which is roughly a third of waking hours, and on the first of a month puts the expense in the previous month's Report. The browser already knows the user's local date everywhere they go, so passing it costs one field and is correct without configuration.

## Consequences

- The API trusts the client's date. That is acceptable for a single-user personal app; it would not be for a multiuser one where dates carry financial meaning.
- A request with no client date is a validation error rather than a silent fallback to UTC. A fallback would reintroduce the off-by-one invisibly.
- Report ranges are explicit parameters, never defaulted server-side. "This month" is computed by the client.
- Background or scheduled work, if ever added, has no server-side notion of "today" and must receive a date explicitly.

## Considered Options

- **`APP_TIMEZONE` env var** (e.g. `Asia/Jakarta`). Correct for one location, wrong when traveling, and reintroduces server-side date derivation.
- **Ignore it, use UTC.** Rejected: silently wrong dates for the hours the user is most likely to record morning expenses.
