import type { Expense, ListExpensesQuery } from "@expense/contract"
import { useMutationState, useQuery } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { isExpense, isExpenseAction, placeExpense, statusAfter } from "./expenseLists.ts"

/** Every cached Expense list starts with this key, so one invalidation refreshes them all. */
export const expensesKey = ["expenses"] as const

/**
 * `GET /expenses`: confirmed unless `query.status` says otherwise, newest date first.
 * Confirms and discards still in flight are applied on top, so a refetch while
 * one is pending cannot bring the old row back, and a failed one simply drops out.
 */
export const useExpenses = (query: ListExpensesQuery) => {
  const moving = useMutationState({
    filters: { mutationKey: expensesKey, status: "pending" },
    select: (mutation): Expense | null => {
      const action = mutation.options.mutationKey?.[1]
      const expense = mutation.state.variables
      return isExpenseAction(action) && isExpense(expense)
        ? { ...expense, status: statusAfter[action] }
        : null
    },
  })
  return useQuery({
    queryKey: [...expensesKey, query],
    queryFn: () => api((client) => client.expenses.list({ query })),
    select: (list) =>
      moving.reduce<ReadonlyArray<Expense>>(
        (shown, expense) => (expense === null ? shown : placeExpense(shown, query, expense)),
        list,
      ),
  })
}
