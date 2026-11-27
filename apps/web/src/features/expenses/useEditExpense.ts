import type { EditExpense, ExpenseId } from "@expense/contract"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { writeIntoLists } from "./useExpenseActions.ts"
import { expensesKey } from "../../shared/api/queryKeys.ts"

/** `PATCH /expenses/:id`: changes a Draft or confirmed Expense, then refreshes every Expense list. */
export const useEditExpense = (id: ExpenseId) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: EditExpense) =>
      api((client) => client.expenses.edit({ params: { id }, payload })),
    onSuccess: (saved) => {
      writeIntoLists(queryClient, saved)
      return queryClient.invalidateQueries({ queryKey: expensesKey })
    },
  })
}
