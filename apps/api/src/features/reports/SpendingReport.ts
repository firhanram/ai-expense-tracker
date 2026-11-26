import type { Report, ReportQuery } from "@expense/contract"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql"
import { isSpent } from "../expenses/ExpenseStore.ts"

/** A grouped figure as D1 returns it. */
const TotalRow = Schema.Struct({
  label: Schema.String,
  category_id: Schema.NullOr(Schema.Int),
  amount: Schema.Int,
})
const decodeTotals = Schema.decodeUnknownEffect(Schema.Array(TotalRow))
const decodeSum = Schema.decodeUnknownEffect(Schema.Tuple([Schema.Struct({ amount: Schema.Int })]))

/**
 * A Report, aggregated in SQL (PLAN, "Reports"), shared by `GET /reports` and
 * the agent's `query_spending` tool so both give the same figures. Only
 * money actually spent counts (`isSpent`, ADR-0002), and refunds are negative amounts, so
 * `SUM` nets them out. The range is the caller's, both ends included; nothing
 * here reads the clock (ADR-0009).
 */
export const spendingReport = (query: ReportQuery) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const inRange = sql`${isSpent(sql)} AND e.occurred_at BETWEEN ${query.from} AND ${query.to}`

    const grouped =
      query.groupBy === "category"
        ? sql`
            SELECT c.name AS label, c.id AS category_id, SUM(e.amount) AS amount
            FROM expense e JOIN category c ON c.id = e.category_id
            WHERE ${inRange}
            GROUP BY c.id
            ORDER BY c.sort_order`
        : sql`
            SELECT strftime('%Y-%m', e.occurred_at) AS label, NULL AS category_id, SUM(e.amount) AS amount
            FROM expense e
            WHERE ${inRange}
            GROUP BY label
            ORDER BY label`

    const [rows, [sum]] = yield* Effect.all([
      grouped.pipe(Effect.flatMap(decodeTotals)),
      sql`SELECT COALESCE(SUM(e.amount), 0) AS amount FROM expense e WHERE ${inRange}`.pipe(
        Effect.flatMap(decodeSum),
      ),
    ]).pipe(Effect.orDie)

    return {
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      total: sum.amount,
      totals: rows.map((row) => ({
        label: row.label,
        categoryId: row.category_id,
        amount: row.amount,
      })),
    } satisfies Report
  })
