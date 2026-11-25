import { Api, type ListExpensesQuery, UnknownCategory } from "@expense/contract"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { decodeRows, toExpense } from "./ExpenseRow.ts"

export const ExpensesLive = HttpApiBuilder.group(Api, "expenses", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    /**
     * One predicate per filter, ANDed. Confirmed only for now (ADR-0002: what
     * the user calls "my Expenses" is money actually spent). A filter added to
     * `ListExpensesQuery` adds its fragment here.
     */
    const listFilters = (query: ListExpensesQuery) => [
      sql`status = 'confirmed'`,
      ...(query.from === undefined ? [] : [sql`occurred_at >= ${query.from}`]),
      ...(query.to === undefined ? [] : [sql`occurred_at <= ${query.to}`]),
      ...(query.categoryId === undefined ? [] : [sql`category_id = ${query.categoryId}`]),
    ]

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
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          // One statement (ADR-0010): selecting from `category` inserts nothing
          // when the Category is unknown, so no row means UnknownCategory.
          const rows = yield* sql`
            INSERT INTO expense (id, amount, category_id, merchant, note, occurred_at, created_at, status)
            SELECT ${crypto.randomUUID()}, ${payload.amount}, id, ${payload.merchant ?? null},
                   ${payload.note ?? null}, ${payload.occurredAt}, ${new Date().toISOString()}, 'confirmed'
            FROM category WHERE id = ${payload.categoryId}
            RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
          const [row] = rows
          if (row === undefined) {
            return yield* new UnknownCategory({ categoryId: payload.categoryId })
          }
          return toExpense(row)
        }),
      )
  }),
)
