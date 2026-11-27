import { type Expense, type ExpenseId, ExpenseNotFound } from "@expense/contract"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { expenseKey } from "../../shared/api/queryKeys.ts"
import { useMovingExpenses } from "../expenses/index.ts"

export type ExpenseLookup =
  | { readonly state: "loading" }
  | { readonly state: "found"; readonly expense: Expense }
  | { readonly state: "not-found" }
  | { readonly state: "failed" }

/**
 * `GET /expenses/:id`, whatever its status. The key starts with `expensesKey`,
 * so a confirm, edit or delete that invalidates the lists refreshes the card
 * too. A confirm or discard still in flight shows as its outcome, as in the lists.
 */
export const useExpense = (id: ExpenseId): ExpenseLookup => {
  const moving = useMovingExpenses().find((candidate) => candidate.id === id)
  const query = useQuery({
    queryKey: expenseKey(id),
    queryFn: () => api((client) => client.expenses.get({ params: { id } })),
    retry: (failures, error) => !(error instanceof ExpenseNotFound) && failures < 3,
  })
  if (moving !== undefined) return { state: "found", expense: moving }
  if (query.error instanceof ExpenseNotFound) return { state: "not-found" }
  if (query.data !== undefined) return { state: "found", expense: query.data }
  if (query.isPending) return { state: "loading" }
  return { state: "failed" }
}
