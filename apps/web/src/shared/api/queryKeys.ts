import type { ExpenseId } from "@expense/contract"

/**
 * Every cached Expense list starts with this key, so one invalidation
 * refreshes them all; Reports and charts sit under it too, since an Expense
 * change moves their totals.
 */
export const expensesKey = ["expenses"] as const

/** One Expense by id (`GET /expenses/:id`), under `expensesKey` so the same invalidation reaches it. */
export const expenseKey = (id: ExpenseId) => [...expensesKey, "one", id] as const
