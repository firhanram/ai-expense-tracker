import type { Expense } from "@expense/contract"
import { Schema } from "effect"

/** An `expense` row as D1 returns it. */
export const ExpenseRow = Schema.Struct({
  id: Schema.String,
  amount: Schema.Int,
  category_id: Schema.Int,
  merchant: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  occurred_at: Schema.String,
  created_at: Schema.String,
  status: Schema.Literals(["draft", "confirmed", "discarded"]),
  needs_review: Schema.Literals([0, 1]),
})
export type ExpenseRow = typeof ExpenseRow.Type

export const decodeRows = Schema.decodeUnknownEffect(Schema.Array(ExpenseRow))

export const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  amount: row.amount,
  categoryId: row.category_id,
  merchant: row.merchant,
  note: row.note,
  occurredAt: row.occurred_at,
  createdAt: row.created_at,
  status: row.status,
  needsReview: row.needs_review === 1,
})
