# Expense Tracking

A personal expense tracker where the user records spending by conversing with an AI agent, and the agent responds with rendered UI rather than prose.

## Language

**Expense**:
A confirmed record of money spent, with an amount in whole Rupiah, a date, and a Category.
_Avoid_: Transaction, purchase, spending, entry

**Draft Expense**:
A proposed Expense the user has not yet approved. It has its own identity, is persisted before the user sees it, and becomes an Expense in place when confirmed.
_Avoid_: Pending expense, suggestion, proposal, confirmation card

**Receipt**:
An image the user supplies as evidence of a payment, from which a Draft Expense may be derived.
_Avoid_: Bill, invoice, photo, screenshot

**Category**:
One of a fixed, seeded set of spending classifications that an Expense belongs to, used to group Report figures. The agent assigns one; the user may change it. The set is closed: `Other` is a failure of classification, not a place for miscellaneous spending. The twelve Categories are Groceries, Dining, Transport, Utilities, Housing, Shopping, Health, Entertainment, Education, Giving & family, Pets and Other; their boundaries are in ADR-0004.
_Avoid_: Tag, label, type, bucket

**Report**:
An aggregation of confirmed Expenses over a date range, expressed as figures and rendered as a chart. Figures are computed by the server, never by the agent, and are grouped by Category or by month.
_Avoid_: Summary, stats, analytics

**Chat**:
The single, continuous conversation through which the user records Expenses. It is never split into threads, and it is the only way a Draft Expense is created.
_Avoid_: Session, thread, conversation history
