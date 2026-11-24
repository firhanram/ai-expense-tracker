# Render components by id, never by value

Rendered UI components (draft expense cards, expense cards, charts) take an **id and a range**, never the data they display. The model decides *what* to show; it never restates a number.

A model that emits `DraftExpenseCard(amount: 10000, category: "Shopping")` can emit a figure that was never in the database. An id-only component fetches the record through the API, so a hallucinated amount cannot reach the screen, a card reflects confirmation without a second model call, and reloading the page re-renders live data rather than a frozen snapshot.

## Consequences

- One fetch per rendered card; every component needs a loading and not-found state.
- Chart payloads stay tiny — the model emits a range, not twelve months of numbers. This is mandatory, not merely tidy: chart values arrive as positional literal arguments in the generated UI, so unfurled series would cost tokens proportional to the number of data points.

## Considered Options

- **Value-carrying components** (the library default). Rejected: every rendered figure becomes unverified model output.
- **Server-rendered HTML fragments.** Rejected: loses typed props, per-component states, and reload-consistency.
