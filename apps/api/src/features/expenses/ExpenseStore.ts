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
import { ReceiptStore } from "../receipts/ReceiptStore.ts"
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
 * The Draft read from a Receipt (one Receipt, one Draft). The first proposal
 * inserts it; a later one, in the same turn or when the user sends the same
 * Receipt again, overwrites that Draft instead of adding a second: one
 * upsert on the `expense_receipt` unique index. A Receipt whose Expense is
 * already confirmed is refused with `ExpenseConfirmed` naming that Expense.
 */
export const proposeFromReceipt = (
  input: CreateExpense,
  options: { readonly receiptKey: string; readonly needsReview: boolean },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // `WHERE id = ...` before `ON CONFLICT` also keeps SQLite from reading it as a join.
    const [row] = yield* sql`
      INSERT INTO expense (id, amount, category_id, merchant, note, occurred_at, created_at, status, needs_review, receipt_key)
      SELECT ${crypto.randomUUID()}, ${input.amount}, id, ${input.merchant ?? null},
             ${input.note ?? null}, ${input.occurredAt}, ${new Date().toISOString()},
             'draft', ${options.needsReview ? 1 : 0}, ${options.receiptKey}
      FROM category WHERE id = ${input.categoryId}
      ON CONFLICT (receipt_key) WHERE receipt_key IS NOT NULL DO UPDATE SET
        amount = excluded.amount, category_id = excluded.category_id,
        merchant = excluded.merchant, note = excluded.note,
        occurred_at = excluded.occurred_at, needs_review = excluded.needs_review
      WHERE expense.status = 'draft'
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    if (row !== undefined) return toExpense(row)
    const [holder] = yield* sql<{ id: string }>`
      SELECT id FROM expense WHERE receipt_key = ${options.receiptKey}`.pipe(Effect.orDie)
    return yield* Effect.fail(
      holder === undefined
        ? new UnknownCategory({ categoryId: input.categoryId })
        : new ExpenseConfirmed({ id: holder.id }),
    )
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
    // Discarding lets go of the Receipt: an upload that never became an Expense is not kept.
    const set = to === "discarded" ? sql`status = ${to}, receipt_key = NULL` : sql`status = ${to}`
    const updated = yield* sql`
      UPDATE expense SET ${set}
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

/**
 * Draft to discarded, keeping the row but deleting its Receipt (story 16: an
 * upload that never becomes an Expense is deleted too). A confirmed Expense
 * stays confirmed, Receipt and all. The key is read first because `RETURNING`
 * gives the row after the UPDATE has cleared it.
 */
export const discardExpense = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const receipts = yield* ReceiptStore
    const held = yield* sql<{ receipt_key: string }>`
      SELECT receipt_key FROM expense
      WHERE id = ${id} AND status = 'draft' AND receipt_key IS NOT NULL`.pipe(Effect.orDie)
    const discarded = yield* transition(
      id,
      "discarded",
      ["draft", "discarded"],
      () => new ExpenseConfirmed({ id }),
    )
    yield* receipts.remove(held.map((row) => row.receipt_key))
    return discarded
  })
