import { Report, ReportQuery } from "@expense/contract"
import { Effect } from "effect"
import { Tool } from "effect/ai"
import { SqlClient } from "effect/sql"
import { captureServices } from "../../captureServices.ts"
import { spendingReport } from "./SpendingReport.ts"

/**
 * The agent's reporting tool (PLAN, "The chat turn"). It returns the same
 * figures as `GET /reports`, so the model quotes server totals and never adds
 * numbers itself. Bad params go back to the model as a failed result it can
 * correct, rather than ending the turn.
 */
export const QuerySpending = Tool.make("query_spending", {
  description:
    "Net spending on confirmed Expenses between two dates, both included, grouped by Category or by month, " +
    "with the range's total. Work out the dates from the user's local date; both are required. " +
    "Quote these figures as given; never add them up yourself.",
  parameters: ReportQuery,
  success: Report,
  failureMode: "return",
})

/**
 * The tool's handler, holding the `SqlClient` it was built with so a toolkit
 * layer needs nothing per call: `Toolkit.toLayer(... { query_spending: yield* QuerySpendingHandler })`.
 */
export const QuerySpendingHandler = Effect.gen(function* () {
  const withSql = yield* captureServices(SqlClient.SqlClient)
  return (params: ReportQuery) => withSql(spendingReport(params))
})
