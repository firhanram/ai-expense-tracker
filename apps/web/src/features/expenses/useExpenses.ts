import type { Expense, ListExpensesQuery } from "@expense/contract"
import { useMutationState, useQuery } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { isExpense, isExpenseAction, placeExpense, statusAfter } from "./expenseLists.ts"

/** Every cached Expense list starts with this key, so one invalidation refreshes them all. */
export const expensesKey = ["expenses"] as const

/**
 * Confirms and discards still in flight, each as the Expense will read once it
 * succeeds. Layered over cached lists so a refetch while one is pending cannot
 * bring the old state back, and a failed one simply drops out.
 */
export const useMovingExpenses = (): ReadonlyArray<Expense> =>
  useMutationState({
    filters: { mutationKey: expensesKey, status: "pending" },
    select: (mutation): Expense | null => {
      const action = mutation.options.mutationKey?.[1]
      const expense = mutation.state.variables
      return isExpenseAction(action) && isExpense(expense)
        ? { ...expense, status: statusAfter[action] }
        : null
    },
  }).filter((expense) => expense !== null)

/**
 * `GET /expenses`: confirmed unless `query.status` says otherwise, newest date first,
 * with in-flight confirms and discards applied on top (`useMovingExpenses`).
 */
export const useExpenses = (query: ListExpensesQuery) => {
  const moving = useMovingExpenses()
  return useQuery({
    queryKey: [...expensesKey, query],
    queryFn: () => api((client) => client.expenses.list({ query })),
    select: (list) =>
      moving.reduce<ReadonlyArray<Expense>>(
        (shown, expense) => placeExpense(shown, query, expense),
        list,
      ),
  })
}
