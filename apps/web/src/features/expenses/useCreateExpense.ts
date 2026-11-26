import type { CreateExpense } from "@expense/contract"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { expensesKey } from "./useExpenses.ts"

/** `POST /expenses`: records a confirmed Expense, then refreshes every Expense list. */
export const useCreateExpense = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateExpense) => api((client) => client.expenses.create({ payload })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesKey }),
  })
}
