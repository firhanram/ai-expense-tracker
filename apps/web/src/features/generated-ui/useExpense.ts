import { type Expense, type ExpenseId, ExpenseStatus } from "@expense/contract"
import { useQueries } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { expensesKey } from "../expenses/useExpenses.ts"

export type ExpenseLookup =
  | { readonly state: "loading" }
  | { readonly state: "found"; readonly expense: Expense }
  | { readonly state: "not-found" }
  | { readonly state: "failed" }

/**
 * One Expense by id. The contract has no `GET /expenses/:id`, so this reads
 * the lists of every status (the same cache entries as `useExpenses`, so a
 * confirm or edit that invalidates `expensesKey` refreshes the card too).
 */
export const useExpense = (id: ExpenseId): ExpenseLookup => {
  const lists = useQueries({
    queries: ExpenseStatus.literals.map((status) => {
      const query = { status }
      return {
        queryKey: [...expensesKey, query],
        queryFn: () => api((client) => client.expenses.list({ query })),
      }
    }),
  })
  for (const list of lists) {
    const expense = list.data?.find((candidate) => candidate.id === id)
    if (expense !== undefined) return { state: "found", expense }
  }
  if (lists.some((list) => list.isPending)) return { state: "loading" }
  if (lists.some((list) => list.isError)) return { state: "failed" }
  return { state: "not-found" }
}
