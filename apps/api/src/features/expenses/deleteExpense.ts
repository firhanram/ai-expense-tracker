import { ExpenseNotFound } from "@expense/contract"
import { Effect, Schema } from "effect"
import type { SqlClient } from "effect/sql"

const decodeDeleted = Schema.decodeUnknownEffect(
  Schema.Array(Schema.Struct({ receipt_key: Schema.NullOr(Schema.String) })),
)

/**
 * `DELETE /expenses/:id`. A hard delete of any Expense, whatever its status:
 * it leaves the list and every Report because the row is gone.
 */
export const deleteExpense = (sql: SqlClient.SqlClient, id: string) =>
  Effect.gen(function* () {
    // One statement (ADR-0010). `RETURNING` hands back the receipt key so the
    // R2 object can be removed after the row is gone.
    const [deleted] = yield* sql`DELETE FROM expense WHERE id = ${id} RETURNING receipt_key`.pipe(
      Effect.flatMap(decodeDeleted),
      Effect.orDie,
    )
    if (deleted === undefined) {
      return yield* new ExpenseNotFound({ id })
    }
    // TODO(#14): when `deleted.receipt_key` is not null, delete that R2 object
    // here. Nothing writes `receipt_key` until receipts land, so it is always
    // null today.
    return undefined
  })
