import { Api, type ListExpensesQuery } from "@expense/contract"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { deleteExpense } from "./deleteExpense.ts"
import { editExpense } from "./editExpense.ts"
import { decodeRows, toExpense } from "./ExpenseRow.ts"
import { confirmExpense, discardExpense, insertExpense } from "./ExpenseStore.ts"

export const ExpensesLive = HttpApiBuilder.group(Api, "expenses", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    /**
     * One predicate per filter, ANDed. A filter added to `ListExpensesQuery`
     * adds its fragment here. Status defaults to confirmed (ADR-0002: what the
     * user calls "my Expenses" is money actually spent).
     */
    const listFilters = (query: ListExpensesQuery) => [
      sql`status = ${query.status ?? "confirmed"}`,
      ...(query.from === undefined ? [] : [sql`occurred_at >= ${query.from}`]),
      ...(query.to === undefined ? [] : [sql`occurred_at <= ${query.to}`]),
      ...(query.categoryId === undefined ? [] : [sql`category_id = ${query.categoryId}`]),
    ]

    // The store asks for `SqlClient` per call; handlers may not leave it to the request.
    const withSql = Effect.provideService(SqlClient.SqlClient, sql)

    return handlers
      .handle("list", ({ query }) =>
        sql`
          SELECT * FROM expense
          WHERE ${sql.and(listFilters(query))}
          ORDER BY occurred_at DESC, created_at DESC, rowid DESC`.pipe(
          Effect.flatMap(decodeRows),
          Effect.map((rows) => rows.map(toExpense)),
          Effect.orDie,
        ),
      )
      .handle("create", ({ payload }) => withSql(insertExpense(payload, { status: "confirmed" })))
      .handle("confirm", ({ params }) => withSql(confirmExpense(params.id)))
      .handle("discard", ({ params }) => withSql(discardExpense(params.id)))
      .handle("edit", ({ params, payload }) => editExpense(sql, params.id, payload))
      .handle("remove", ({ params }) => deleteExpense(sql, params.id))
  }),
)
