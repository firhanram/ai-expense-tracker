import type { IsoDate } from "@expense/contract"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { expensesKey } from "./useExpenses.ts"

/**
 * `GET /reports?groupBy=category`: the range's confirmed net spending, in total
 * and per Category. Keyed under `expensesKey` so whatever refreshes the
 * Expense lists after a change refreshes these totals too.
 */
export const useCategoryTotals = (range: { readonly from: IsoDate; readonly to: IsoDate }) =>
  useQuery({
    queryKey: [...expensesKey, "category-totals", range],
    queryFn: () =>
      api((client) => client.reports.get({ query: { ...range, groupBy: "category" } })),
  })
