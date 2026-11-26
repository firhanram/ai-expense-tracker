import type { ListExpensesQuery } from "@expense/contract"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"

/** Every cached Expense list starts with this key, so one invalidation refreshes them all. */
export const expensesKey = ["expenses"] as const

/** `GET /expenses`: confirmed unless `query.status` says otherwise, newest date first. */
export const useExpenses = (query: ListExpensesQuery) =>
  useQuery({
    queryKey: [...expensesKey, query],
    queryFn: () => api((client) => client.expenses.list({ query })),
  })
