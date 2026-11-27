import {
  type CreateExpense,
  type EditExpense,
  ExpenseConfirmed,
  ExpenseDiscarded,
  type ExpenseId,
  ExpenseNotFound,
  type ExpenseStatus,
  type ListExpensesQuery,
  type ReceiptKey,
  UnknownCategory,
} from "@expense/contract"
import { Effect, Option, Schema } from "effect"
import { SqlClient } from "effect/sql"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"
import { categoryExists } from "./Categories.ts"
import { decodeRows, ExpenseRow, toExpense } from "./ExpenseRow.ts"

/**
 * Every read and write of `expense`. The HTTP handlers, the agent's tools,
 * the Receipt turn and the orphan sweep all come here, so the table's rules
 * live in one module. Each function reads its services from context per
 * call; a handler provides them with `captureStores`. Every write is one
 * statement (ADR-0010): never `sql.withTransaction`, which dies on D1.
 */

/** The status that means "money actually spent" (ADR-0002). */
export const spentStatus = "confirmed" satisfies ExpenseStatus

/**
 * The predicate of every query that means "money actually spent" (ADR-0002):
 * the default Expense list and every Report, so `query_spending` too. It
 * names `status` unqualified, which in a join with `category` is still
 * `expense.status`.
 */
export const isSpent = (sql: SqlClient.SqlClient) => sql`status = ${spentStatus}`

/** One predicate per filter, ANDed. A filter added to `ListExpensesQuery` adds its fragment here. */
const listFilters = (sql: SqlClient.SqlClient, query: ListExpensesQuery) => [
  query.status === undefined ? isSpent(sql) : sql`status = ${query.status}`,
  ...(query.from === undefined ? [] : [sql`occurred_at >= ${query.from}`]),
  ...(query.to === undefined ? [] : [sql`occurred_at <= ${query.to}`]),
  ...(query.categoryId === undefined ? [] : [sql`category_id = ${query.categoryId}`]),
]

/**
 * `GET /expenses`: newest date first, and within a date the later recorded
 * first. Without a status it lists money spent, what the user calls "my
 * Expenses" (ADR-0002).
 */
export const listExpenses = (query: ListExpensesQuery) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      SELECT * FROM expense
      WHERE ${sql.and(listFilters(sql, query))}
      ORDER BY occurred_at DESC, created_at DESC, rowid DESC`.pipe(
      Effect.flatMap(decodeRows),
      Effect.orDie,
    )
    return rows.map(toExpense)
  })

/** The Expense with this id, whatever its status. */
export const findExpense = (id: ExpenseId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const [row] = yield* sql`SELECT * FROM expense WHERE id = ${id}`.pipe(
      Effect.flatMap(decodeRows),
      Effect.orDie,
    )
    return Option.map(Option.fromUndefinedOr(row), toExpense)
  })

/** `GET /expenses/:id`: the Expense with this id whatever its status, or ExpenseNotFound. */
export const getExpense = (id: ExpenseId) =>
  findExpense(id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new ExpenseNotFound({ id })),
        onSome: Effect.succeed,
      }),
    ),
  )

const decodeHolders = Schema.decodeUnknownEffect(
  Schema.Array(ExpenseRow.mapFields((fields) => ({ id: fields.id, status: fields.status }))),
)

/** The Expense holding this Receipt, if any (one Receipt, one Expense): its id and status. */
export const receiptHolder = (receiptKey: ReceiptKey) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const [holder] =
      yield* sql`SELECT id, status FROM expense WHERE receipt_key = ${receiptKey}`.pipe(
        Effect.flatMap(decodeHolders),
        Effect.orDie,
      )
    return Option.fromUndefinedOr(holder)
  })

const decodeKeys = Schema.decodeUnknownEffect(
  Schema.Array(ExpenseRow.mapFields((fields) => ({ receipt_key: fields.receipt_key }))),
)

/** Which of `keys` an Expense holds. D1 binds at most 100 parameters, so pass at most 100. */
export const heldReceiptKeys = (keys: ReadonlyArray<ReceiptKey>) =>
  Effect.gen(function* () {
    if (keys.length === 0) return []
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      SELECT receipt_key FROM expense WHERE receipt_key IN ${sql.in(keys)}`.pipe(
      Effect.flatMap(decodeKeys),
      Effect.orDie,
    )
    return rows.flatMap((row) => (row.receipt_key === null ? [] : [row.receipt_key]))
  })

/**
 * The INSERT both inserts share. Selecting from `category` inserts nothing
 * when the Category is unknown, so no row means UnknownCategory.
 */
const insertSelect = (
  sql: SqlClient.SqlClient,
  input: CreateExpense,
  fields: {
    readonly status: ExpenseStatus
    readonly needsReview: boolean
    readonly receiptKey: ReceiptKey | null
  },
) => sql`
  INSERT INTO expense (id, amount, category_id, merchant, note, occurred_at, created_at, status, needs_review, receipt_key)
  SELECT ${crypto.randomUUID()}, ${input.amount}, id, ${input.merchant ?? null},
         ${input.note ?? null}, ${input.occurredAt}, ${new Date().toISOString()},
         ${fields.status}, ${fields.needsReview ? 1 : 0}, ${fields.receiptKey}
  FROM category WHERE id = ${input.categoryId}`

/**
 * Inserts an Expense with the given status: `confirmed` for a manual entry,
 * `draft` for one the agent proposes (ADR-0002).
 */
export const insertExpense = (
  input: CreateExpense,
  options: {
    readonly status: Extract<ExpenseStatus, "draft" | "confirmed">
    readonly needsReview?: boolean
  },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const fields = { status: options.status, needsReview: options.needsReview === true }
    const [row] = yield* sql`
      ${insertSelect(sql, input, { ...fields, receiptKey: null })}
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
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
  options: { readonly receiptKey: ReceiptKey; readonly needsReview: boolean },
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const fields = { status: "draft" as const, ...options }
    // The `WHERE id = ...` that ends the SELECT, before `ON CONFLICT`, also keeps SQLite from reading it as a join.
    const [row] = yield* sql`
      ${insertSelect(sql, input, fields)}
      ON CONFLICT (receipt_key) WHERE receipt_key IS NOT NULL DO UPDATE SET
        amount = excluded.amount, category_id = excluded.category_id,
        merchant = excluded.merchant, note = excluded.note,
        occurred_at = excluded.occurred_at, needs_review = excluded.needs_review
      WHERE expense.status = 'draft'
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    if (row !== undefined) return toExpense(row)
    const holder = yield* receiptHolder(options.receiptKey)
    return yield* Effect.fail(
      Option.match(holder, {
        onNone: () => new UnknownCategory({ categoryId: input.categoryId }),
        onSome: ({ id }) => new ExpenseConfirmed({ id }),
      }),
    )
  })

/**
 * `PATCH /expenses/:id`. Drafts and confirmed Expenses are editable; a
 * discarded one is out of the user's reach, so it reads as not found.
 * `editable` narrows that further: the agent may edit only Drafts (ADR-0007).
 */
export const editExpense = (
  id: ExpenseId,
  edit: EditExpense,
  editable: ReadonlyArray<ExpenseStatus> = ["draft", "confirmed"],
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // The Category set is fixed by migration (ADR-0004), so checking it before
    // the UPDATE cannot race; the UPDATE itself stays one statement (ADR-0010).
    if (edit.categoryId !== undefined && !(yield* categoryExists(edit.categoryId))) {
      return yield* new UnknownCategory({ categoryId: edit.categoryId })
    }

    const assignments = {
      ...(edit.amount !== undefined && { amount: edit.amount }),
      ...(edit.categoryId !== undefined && { category_id: edit.categoryId }),
      ...(edit.merchant !== undefined && { merchant: edit.merchant }),
      ...(edit.note !== undefined && { note: edit.note }),
      ...(edit.occurredAt !== undefined && { occurred_at: edit.occurredAt }),
      ...(edit.needsReview !== undefined && { needs_review: edit.needsReview ? 1 : 0 }),
    }
    // An empty edit still has to find the Expense, so it assigns nothing real.
    const set = Object.keys(assignments).length > 0 ? sql.update(assignments) : sql`id = id`

    const [row] = yield* sql`
      UPDATE expense SET ${set}
      WHERE id = ${id} AND status IN ${sql.in(editable)}
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    if (row === undefined) {
      return yield* new ExpenseNotFound({ id })
    }
    return toExpense(row)
  })

const decodeDeleted = Schema.decodeUnknownEffect(
  Schema.Array(ExpenseRow.mapFields((fields) => ({ receipt_key: fields.receipt_key }))),
)

/**
 * `DELETE /expenses/:id`. A hard delete of any Expense, whatever its status:
 * it leaves the list and every Report because the row is gone. Its Receipt
 * goes with it (story 16).
 */
export const deleteExpense = (id: ExpenseId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const receipts = yield* ReceiptStore
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
      yield* receipts.remove([deleted.receipt_key])
    }
    return undefined
  })

/**
 * Moves an Expense to `to` in one conditional UPDATE. `from` lists the statuses
 * it may leave, including `to` itself, so repeating the move matches the row
 * and changes nothing (ADR-0007: a button can be pressed twice). When nothing
 * matched, a read tells a missing id from a refused transition.
 */
const transition = <E>(
  id: ExpenseId,
  to: Exclude<ExpenseStatus, "draft">,
  from: ReadonlyArray<ExpenseStatus>,
  refused: () => E,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // Discarding lets go of the Receipt: an upload that never became an Expense is not kept.
    // Confirming is the user saying they checked it, so it no longer needs review.
    const set =
      to === "discarded"
        ? sql`status = ${to}, receipt_key = NULL`
        : sql`status = ${to}, needs_review = 0`
    const [row] = yield* sql`
      UPDATE expense SET ${set}
      WHERE id = ${id} AND status IN ${sql.in(from)}
      RETURNING *`.pipe(Effect.flatMap(decodeRows), Effect.orDie)
    if (row !== undefined) return toExpense(row)
    const existing = yield* findExpense(id)
    return yield* Effect.fail(Option.isNone(existing) ? new ExpenseNotFound({ id }) : refused())
  })

/** Draft to confirmed. A discarded Expense stays discarded. */
export const confirmExpense = (id: ExpenseId) =>
  transition(id, "confirmed", ["draft", "confirmed"], () => new ExpenseDiscarded({ id }))

/**
 * Draft to discarded, keeping the row but deleting its Receipt (story 16: an
 * upload that never becomes an Expense is deleted too). A confirmed Expense
 * stays confirmed, Receipt and all. The key is read first because `RETURNING`
 * gives the row after the UPDATE has cleared it.
 */
export const discardExpense = (id: ExpenseId) =>
  Effect.gen(function* () {
    const receipts = yield* ReceiptStore
    const before = yield* findExpense(id)
    const discarded = yield* transition(
      id,
      "discarded",
      ["draft", "discarded"],
      () => new ExpenseConfirmed({ id }),
    )
    const held = Option.filter(before, (expense) => expense.status === "draft")
    const receiptKey = Option.getOrNull(Option.flatMapNullishOr(held, (e) => e.receiptKey))
    yield* receipts.remove(receiptKey === null ? [] : [receiptKey])
    return discarded
  })
