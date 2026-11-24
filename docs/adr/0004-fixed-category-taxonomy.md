# The agent assigns categories; it does not invent them

Categories are a fixed, seeded set of rows referenced by foreign key. The agent picks one from that set. It may not create categories, and a category that doesn't fit falls to `Other`.

Letting the model name categories produces `Clothing`, `clothes`, `Cloths`, and `Apparel` within a week, at which point no Report can group anything. A closed set makes the Report trustworthy and makes the agent's choice correctable by the user rather than by a data cleanup.

## Consequences

- A category row, not a database enum: renames and merges are ordinary updates, and an enum would make merging painful.
- The agent can be wrong without being dangerous — the worst outcome is a correct amount in the wrong bucket, visible and fixable on the card before confirming.
- Adding a category is a migration. Deliberate friction: the value of the set is that it is small.
