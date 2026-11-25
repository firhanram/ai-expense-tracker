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
  needsReview: Schema.Boolean,
})
export type Expense = typeof Expense.Type

/**
 * `GET /expenses` query, newest date first. Filters are optional fields, ANDed;
 * query values arrive as strings, so numeric ones need a string codec (e.g.
 * `Schema.NumberFromString.pipe(Schema.decodeTo(Schema.Int))`).
 */
export const ListExpensesQuery = Schema.Struct({
  /** Which status to list. Confirmed when omitted (ADR-0002), so Drafts and discarded rows show only on request. */
  status: Schema.optional(ExpenseStatus),
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
