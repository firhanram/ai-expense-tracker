import { type EditExpense, ExpenseNotFound, UnknownCategory } from "@expense/contract"
import { Effect } from "effect"
import type { SqlClient } from "effect/sql"
import { decodeRows, toExpense } from "./ExpenseRow.ts"

/**
 * `PATCH /expenses/:id`. Drafts and confirmed Expenses are editable; a
 * discarded one is out of the user's reach, so it reads as not found.
 */
export const editExpense = (sql: SqlClient.SqlClient, id: string, edit: EditExpense) =>
  Effect.gen(function* () {
    // The Category set is fixed by migration (ADR-0004), so checking it before
    // the UPDATE cannot race; the UPDATE itself stays one statement (ADR-0010).
    if (edit.categoryId !== undefined) {
      const [category] = yield* sql`SELECT id FROM category WHERE id = ${edit.categoryId}`.pipe(
        Effect.orDie,
      )
      if (category === undefined) {
        return yield* new UnknownCategory({ categoryId: edit.categoryId })
      }
    }

    const assignments = {
      ...(edit.amount !== undefined && { amount: edit.amount }),
      ...(edit.categoryId !== undefined && { category_id: edit.categoryId }),
      ...(edit.merchant !== undefined && { merchant: edit.merchant }),
      ...(edit.note !== undefined && { note: edit.note }),
      ...(edit.occurredAt !== undefined && { occurred_at: edit.occurredAt }),
    }
    // An empty edit still has to find the Expense, so it assigns nothing real.
    const set = Object.keys(assignments).length > 0 ? sql.update(assignments) : sql`id = id`

    const [row] = yield* sql`
      UPDATE expense SET ${set}
      WHERE id = ${id} AND status IN ('draft', 'confirmed')
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    if (row === undefined) {
      return yield* new ExpenseNotFound({ id })
    }
    return toExpense(row)
  })
