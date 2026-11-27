import type { ReportQuery } from "@expense/contract"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { expensesKey } from "../../shared/api/queryKeys.ts"

/**
 * `GET /reports`: the range's confirmed net spending, totalled by the server.
 * Keyed under `expensesKey`, so confirming or editing an Expense refreshes
 * every chart showing it.
 */
export const useReport = (query: ReportQuery) =>
  useQuery({
    queryKey: [...expensesKey, "report", query],
    queryFn: () => api((client) => client.reports.get({ query })),
  })
