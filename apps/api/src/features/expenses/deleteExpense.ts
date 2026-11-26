import { ExpenseNotFound } from "@expense/contract"
import { Effect, Schema } from "effect"
import type { SqlClient } from "effect/sql"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"

const decodeDeleted = Schema.decodeUnknownEffect(
  Schema.Array(Schema.Struct({ receipt_key: Schema.NullOr(Schema.String) })),
)

/**
 * `DELETE /expenses/:id`. A hard delete of any Expense, whatever its status:
 * it leaves the list and every Report because the row is gone. Its Receipt
 * goes with it (story 16).
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
    if (deleted.receipt_key !== null) {
      // After the row: an R2 failure then leaves an orphan the sweep removes,
      // never an Expense pointing at a missing image.
      const receipts = yield* ReceiptStore
      yield* receipts.remove([deleted.receipt_key])
    }
    return undefined
  })
