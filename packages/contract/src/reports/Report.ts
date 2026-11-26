import { Schema } from "effect"
import { CategoryId, IsoDate, Rupiah } from "../expenses/Expense.ts"

/** How a Report groups its figures: by Category, or by calendar month (`YYYY-MM`). */
export const ReportGroupBy = Schema.Literals(["category", "month"])
export type ReportGroupBy = typeof ReportGroupBy.Type

/**
 * `GET /reports` query and the `query_spending` tool's parameters. Both dates
 * are required and inclusive; the client computes the range, so the server
 * derives none (ADR-0009).
 */
export const ReportQuery = Schema.Struct({
  from: IsoDate,
  to: IsoDate,
  groupBy: ReportGroupBy,
})
export type ReportQuery = typeof ReportQuery.Type

/** One figure: a Category's or a month's net spending, refunds subtracted. */
export const ReportTotal = Schema.Struct({
  /** The Category's name, or the month as `YYYY-MM`. */
  label: Schema.String,
  /** The Category, when grouped by Category; null when grouped by month. */
  categoryId: Schema.NullOr(CategoryId),
  amount: Rupiah,
})
export type ReportTotal = typeof ReportTotal.Type

/**
 * A Report: confirmed Expenses in the range, aggregated by the server. Groups
 * with nothing recorded are absent. Category groups come in Category order,
 * months oldest first. `total` is the whole range's net spending.
 */
export const Report = Schema.Struct({
  from: IsoDate,
  to: IsoDate,
  groupBy: ReportGroupBy,
  total: Rupiah,
  totals: Schema.Array(ReportTotal),
})
export type Report = typeof Report.Type
