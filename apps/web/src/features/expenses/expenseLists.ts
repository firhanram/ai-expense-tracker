import { Expense, ListExpensesQuery } from "@expense/contract"
import { Schema } from "effect"

// The query cache holds keys and mutation variables as `unknown`.
export const isExpense = Schema.is(Expense)
export const isListQuery = Schema.is(ListExpensesQuery)

/** A Draft action, named as its endpoint and as its mutation key's last part. */
export type ExpenseAction = "confirm" | "discard"

export const statusAfter = {
  confirm: "confirmed",
  discard: "discarded",
} as const satisfies Record<ExpenseAction, Expense["status"]>

export const isExpenseAction = (value: unknown): value is ExpenseAction =>
  value === "confirm" || value === "discard"

const belongs = (query: ListExpensesQuery, expense: Expense) =>
  (query.status ?? "confirmed") === expense.status &&
  (query.from === undefined || expense.occurredAt >= query.from) &&
  (query.to === undefined || expense.occurredAt <= query.to) &&
  (query.categoryId === undefined || query.categoryId === expense.categoryId)

// The API's order: occurred_at DESC, created_at DESC.
const comesBefore = (a: Expense, b: Expense) =>
  a.occurredAt === b.occurredAt ? a.createdAt > b.createdAt : a.occurredAt > b.occurredAt

/**
 * `list` (the answer to `query`) as it reads once `expense` is in its new
 * state: gone if it no longer matches the query, in date order if it now does.
 */
export const placeExpense = (
  list: ReadonlyArray<Expense>,
  query: ListExpensesQuery,
  expense: Expense,
): ReadonlyArray<Expense> => {
  const rest = list.filter((other) => other.id !== expense.id)
  if (!belongs(query, expense)) return rest
  const at = rest.findIndex((other) => comesBefore(expense, other))
  return at === -1 ? [...rest, expense] : [...rest.slice(0, at), expense, ...rest.slice(at)]
}
