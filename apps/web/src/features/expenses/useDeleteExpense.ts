import { type Expense, type ExpenseId, ExpenseNotFound } from "@expense/contract"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { expensesKey } from "../../shared/api/queryKeys.ts"

/**
 * `DELETE /expenses/:id`, a hard delete. An Expense that is already gone
 * counts as deleted: either way it leaves every cached list at once, and the
 * lists refetch.
 */
export const useDeleteExpense = (id: ExpenseId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api((client) => client.expenses.remove({ params: { id } }))
      } catch (error) {
        if (!(error instanceof ExpenseNotFound)) throw error
      }
    },
    onSuccess: () => {
      // Lists only: the same prefix also holds Reports and single Expenses.
      queryClient.setQueriesData<unknown>({ queryKey: expensesKey }, (cached: unknown) =>
        Array.isArray(cached) ? cached.filter((expense: Expense) => expense.id !== id) : cached,
      )
      return queryClient.invalidateQueries({ queryKey: expensesKey })
    },
  })
}
