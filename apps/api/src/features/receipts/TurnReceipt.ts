import { type ExpenseStatus, type IsoDate, ReceiptNotFound } from "@expense/contract"
import { extendProgram } from "@expense/ui/server"
import { Effect, Option, Schema } from "effect"
import { SqlClient } from "effect/sql"
import { ExpenseRow } from "../expenses/ExpenseRow.ts"
import { proposeFromReceipt } from "../expenses/ExpenseStore.ts"
import { ReceiptStore, type StoredReceipt } from "./ReceiptStore.ts"

/** The Receipt a Chat turn carries: its image, and what it has already become. */
export interface TurnReceipt {
  readonly key: string
  readonly image: StoredReceipt
  /**
   * The Expense already read from this Receipt, if any. One Receipt, one
   * Draft: the turn resumes it rather than proposing a second.
   */
  readonly expense: { readonly id: string; readonly status: ExpenseStatus } | null
}

const decodeHolders = Schema.decodeUnknownEffect(
  Schema.Array(ExpenseRow.mapFields((fields) => ({ id: fields.id, status: fields.status }))),
)

/**
 * Reads the Receipt a Chat message names. A key with nothing stored under it
 * (never uploaded, deleted, or swept) fails the turn before anything is kept.
 */
export const loadTurnReceipt = (key: string) =>
  Effect.gen(function* () {
    const receipts = yield* ReceiptStore
    const sql = yield* SqlClient.SqlClient
    const image = yield* receipts.get(key)
    if (Option.isNone(image)) return yield* new ReceiptNotFound({ receiptKey: key })
    const [holder] = yield* sql`SELECT id, status FROM expense WHERE receipt_key = ${key}`.pipe(
      Effect.flatMap(decodeHolders),
      Effect.orDie,
    )
    return { key, image: image.value, expense: holder ?? null } satisfies TurnReceipt
  })

/**
 * Story 14: an unreadable Receipt still yields a Draft the user can fill in.
 * Run once the model has finished a Receipt turn. When nothing holds the
 * Receipt (the model did not, or could not, propose from it), this makes a
 * placeholder Draft for it (amount 0, Other, the client's date, marked for
 * review) and returns text to append to `reply`, the model's: a line of
 * prose and a block adding the Draft's card to the reply's program.
 * Otherwise it returns "" and changes nothing.
 */
export const draftForUnreadReceipt = (receiptKey: string, clientDate: IsoDate, reply: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const held = yield* sql`SELECT id FROM expense WHERE receipt_key = ${receiptKey}`.pipe(
      Effect.orDie,
    )
    if (held.length > 0) return ""
    const [other] = yield* sql<{ id: number }>`SELECT id FROM category WHERE name = 'Other'`.pipe(
      Effect.orDie,
    )
    if (other === undefined) return yield* Effect.die(new Error("The Other Category is not seeded"))
    const draft = yield* proposeFromReceipt(
      { amount: 0, categoryId: other.id, merchant: null, note: null, occurredAt: clientDate },
      { receiptKey, needsReview: true },
    ).pipe(Effect.orDie)
    return [
      "",
      "",
      "I could not read everything on this Receipt, so here is a Draft to fill in:",
      "",
      // Into the root the model wrote, if any, so the reply stays one program.
      extendProgram(reply, "unreadReceiptDraft", `DraftExpenseCard("${draft.id}")`),
    ].join("\n")
  })

/**
 * What the model is told about the attached Receipt. Read it, propose one
 * Draft from it, and flag what it could not read; or, when the Receipt is
 * already a Draft, change and show that one instead.
 */
export const receiptNote = (receipt: TurnReceipt): string => {
  if (receipt.expense === null) {
    return [
      "The user attached a Receipt image to this message.",
      "Read it and call propose_expense once for its total, with needsReview true if you were unsure of any field.",
      "If you cannot read it, still call propose_expense: amount 0 for a total you cannot read, categoryName Other, needsReview true, and tell the user what to fill in.",
    ].join(" ")
  }
  if (receipt.expense.status === "draft") {
    return [
      `The attached Receipt is already Draft Expense ${receipt.expense.id}.`,
      "Do not propose another from it: change that Draft with update_draft if the user asks, and show it with DraftExpenseCard.",
    ].join(" ")
  }
  return [
    `The attached Receipt is already recorded as Expense ${receipt.expense.id}.`,
    "Do not propose another from it; show it with ExpenseCard.",
  ].join(" ")
}
