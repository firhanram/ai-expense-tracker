import { Schema } from "effect"

/** True when `YYYY-MM-DD` names a day that exists, so `2026-02-30` is rejected. */
const isCalendarDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date)
}

/** A calendar date with no time, `YYYY-MM-DD` (ADR-0009: the client supplies it). */
export const IsoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, { message: "Expected a date as YYYY-MM-DD" }),
  Schema.makeFilter(isCalendarDate, { message: "Expected a date that exists" }),
)
export type IsoDate = typeof IsoDate.Type

/** Whole Rupiah (ADR-0003). Positive is money out, negative is a refund. */
export const Rupiah = Schema.Int
export type Rupiah = typeof Rupiah.Type

export const CategoryId = Schema.Int
export type CategoryId = typeof CategoryId.Type

export const ExpenseStatus = Schema.Literals(["draft", "confirmed", "discarded"])
export type ExpenseStatus = typeof ExpenseStatus.Type

export const Expense = Schema.Struct({
  id: Schema.String,
  amount: Rupiah,
  categoryId: CategoryId,
  merchant: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  occurredAt: IsoDate,
  /** ISO 8601 UTC. When the row was written, not when the money was spent. */
  createdAt: Schema.String,
  status: ExpenseStatus,
  /** The agent was not confident in what it read, e.g. from a faded Receipt: the user should check it. */
  needsReview: Schema.Boolean,
  /**
   * The Receipt this Expense was read from, served at `GET /receipts/:key`;
   * null when it has none. Non-null is how the list marks an Expense with a Receipt.
   */
  receiptKey: Schema.NullOr(Schema.String),
})
export type Expense = typeof Expense.Type

/**
 * `GET /expenses` query, newest date first. Filters are optional fields, ANDed;
 * query values arrive as strings, so numeric ones need a string codec.
 */
export const ListExpensesQuery = Schema.Struct({
  /** Which status to list. Confirmed when omitted (ADR-0002), so Drafts and discarded rows show only on request. */
  status: Schema.optional(ExpenseStatus),
  /** Inclusive lower bound. A month is sent as its first and last day, computed by the client (ADR-0009). */
  from: Schema.optional(IsoDate),
  /** Inclusive upper bound. */
  to: Schema.optional(IsoDate),
  categoryId: Schema.optional(Schema.NumberFromString.pipe(Schema.decodeTo(CategoryId))),
})
export type ListExpensesQuery = typeof ListExpensesQuery.Type

/** `POST /expenses`: a manual Expense, confirmed on creation. */
export const CreateExpense = Schema.Struct({
  amount: Rupiah,
  categoryId: CategoryId,
  merchant: Schema.optional(Schema.NullOr(Schema.String)),
  note: Schema.optional(Schema.NullOr(Schema.String)),
  occurredAt: IsoDate,
})
export type CreateExpense = typeof CreateExpense.Type

/**
 * `PATCH /expenses/:id`: the fields the user can change on a Draft or
 * confirmed Expense. Every field is optional; an omitted field is left as it
 * is, and `null` clears merchant or note.
 */
export const EditExpense = Schema.Struct({
  amount: Schema.optional(Rupiah),
  categoryId: Schema.optional(CategoryId),
  merchant: Schema.optional(Schema.NullOr(Schema.String)),
  note: Schema.optional(Schema.NullOr(Schema.String)),
  occurredAt: Schema.optional(IsoDate),
  /** `false` once the user has checked what the agent was unsure of. Confirming clears it too. */
  needsReview: Schema.optional(Schema.Boolean),
})
export type EditExpense = typeof EditExpense.Type
