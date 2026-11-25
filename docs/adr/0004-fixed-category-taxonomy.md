# The agent assigns categories; it does not invent them

Categories are a fixed, seeded set of rows referenced by foreign key. The agent picks one from that set. It may not create categories, and a category that doesn't fit falls to `Other`.

Letting the model name categories produces `Clothing`, `clothes`, `Cloths`, and `Apparel` within a week, at which point no Report can group anything. A closed set makes the Report trustworthy and makes the agent's choice correctable by the user rather than by a data cleanup.

## Consequences

- A category row, not a database enum: renames and merges are ordinary updates, and an enum would make merging painful.
- The agent can be wrong without being dangerous — the worst outcome is a correct amount in the wrong bucket, visible and fixable on the card before confirming.
- Adding a category is a migration. Deliberate friction: the value of the set is that it is small.

## The seeded set

Eleven rows, in this order. The order is also the chart colour order, so it is part of the seed, not incidental.

| # | Category | Indonesian | Covers |
|---|---|---|---|
| 1 | Groceries | Belanja dapur | Indomaret, Alfamart, Superindo, pasar |
| 2 | Dining | Makan & minum | warung, restaurants, coffee, GoFood / GrabFood orders |
| 3 | Transport | Transportasi | Gojek / Grab rides, KRL / MRT, bensin, parkir, tol |
| 4 | Utilities | Tagihan | PLN token / listrik, PDAM, internet, pulsa & data, gas |
| 5 | Housing | Tempat tinggal | rent / kos, IPL (estate service fees), home repairs |
| 6 | Shopping | Belanja | clothes, electronics, household goods, haircuts and personal care |
| 7 | Health | Kesehatan | apotek, doctor, BPJS premium, insurance |
| 8 | Entertainment | Hiburan | streaming subscriptions, cinema, games, hobbies |
| 9 | Education | Pendidikan | courses, books, school fees |
| 10 | Giving & family | Sosial & keluarga | kondangan, zakat / sedekah, money sent to family, gifts |
| 11 | Other | Lainnya | classification failures only |

Boundaries the agent is told explicitly, because they are where it will hesitate:

- **Utilities vs Entertainment.** Utilities holds what you cannot easily cut: power, water, internet, phone credit. Streaming subscriptions are Entertainment even though they arrive as a monthly charge.
- **Transport vs Dining.** A ride-hailing *ride* is Transport; a food *order* through the same app is Dining.
- **Personal care is Shopping**, not a twelfth Category.
- The category is named **Utilities**, not "Bills", because the glossary reserves "bill" as a word to avoid (it is too close to Receipt).

Open: whether instalment and paylater repayments (*cicilan*) are Expenses at all. Recording the purchase and every repayment double-counts it. Until decided, the agent records the purchase and not the repayments.
