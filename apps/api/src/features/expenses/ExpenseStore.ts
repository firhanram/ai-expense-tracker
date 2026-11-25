import {
  type CreateExpense,
  type Expense,
  ExpenseConfirmed,
  ExpenseDiscarded,
  ExpenseNotFound,
  UnknownCategory,
} from "@expense/contract"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { decodeRows, toExpense } from "./ExpenseRow.ts"

/**
 * Writes to `expense`, shared by the HTTP handlers and the agent's tools.
 * Every write is one statement (ADR-0010): never `sql.withTransaction`, which
 * dies on D1.
 */

/**
 * Inserts an Expense with the given status: `confirmed` for a manual entry,
 * `draft` for one the agent proposes (ADR-0002). Selecting from `category`
 * inserts nothing when the Category is unknown, so no row means UnknownCategory.
 */
export const insertExpense = (
  input: CreateExpense,
  options: { readonly status: "draft" | "confirmed"; readonly needsReview?: boolean },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      INSERT INTO expense (id, amount, category_id, merchant, note, occurred_at, created_at, status, needs_review)
      SELECT ${crypto.randomUUID()}, ${input.amount}, id, ${input.merchant ?? null},
             ${input.note ?? null}, ${input.occurredAt}, ${new Date().toISOString()},
             ${options.status}, ${options.needsReview === true ? 1 : 0}
      FROM category WHERE id = ${input.categoryId}
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    const [row] = rows
    if (row === undefined) {
      return yield* new UnknownCategory({ categoryId: input.categoryId })
    }
    return toExpense(row)
  })

/**
 * Moves an Expense to `to` in one conditional UPDATE. `from` lists the statuses
 * it may leave, including `to` itself, so repeating the move matches the row
 * and changes nothing (ADR-0007: a button can be pressed twice). When nothing
 * matched, a read tells a missing id from a refused transition.
 */
const transition = <E>(
  id: string,
  to: "confirmed" | "discarded",
  from: ReadonlyArray<Expense["status"]>,
  refused: () => E,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const updated = yield* sql`
      UPDATE expense SET status = ${to}
      WHERE id = ${id} AND status IN ${sql.in(from)}
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    const [row] = updated
    if (row !== undefined) return toExpense(row)
    const existing = yield* sql`SELECT id FROM expense WHERE id = ${id}`.pipe(Effect.orDie)
    return yield* Effect.fail(existing.length === 0 ? new ExpenseNotFound({ id }) : refused())
  })

/** Draft to confirmed. A discarded Expense stays discarded. */
export const confirmExpense = (id: string) =>
  transition(id, "confirmed", ["draft", "confirmed"], () => new ExpenseDiscarded({ id }))

/** Draft to discarded, keeping the row. A confirmed Expense stays confirmed. */
export const discardExpense = (id: string) =>
  transition(id, "discarded", ["draft", "discarded"], () => new ExpenseConfirmed({ id }))
