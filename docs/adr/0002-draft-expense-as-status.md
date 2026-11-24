# Draft Expense is a status, not a separate entity

A Draft Expense is a row in the `expense` table with `status = 'draft'`. Confirmation is a status transition on the same row, not a copy into a different table. Discard is likewise a retained status, so the record of what the agent proposed survives.

Nothing is lost by splitting them, and a single table keeps confirmation idempotent: the row already has the identity the user is approving. A separate `draft` table would need a copy step, and a copy step is where amounts and categories diverge from what the user saw.

## Consequences

- Every query that means "money actually spent" must filter `status = 'confirmed'`. Reports, totals, and the expense list all share this predicate; it lives in one place.
- Drafts accumulate indefinitely. This is deliberate: a proposal from last month is still confirmable.
- An expense row can be edited while a draft, so the confirmed Expense is the user's version, not the agent's.
