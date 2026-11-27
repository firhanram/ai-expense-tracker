import {
  type EditExpense,
  type Expense,
  ExpenseId,
  ExpenseStatus,
  IsoDate,
  type ReceiptKey,
  Rupiah,
} from "@expense/contract"
import { Effect, Option, Schema } from "effect"
import { Tool, Toolkit } from "effect/ai"
import type { SqlClient } from "effect/sql"
import type { Provide } from "../../captureServices.ts"
import type { ReceiptStore } from "../receipts/ReceiptStore.ts"
import { Category, listCategories } from "../expenses/Categories.ts"
import {
  discardExpense,
  editExpense,
  findExpense,
  insertExpense,
  proposeFromReceipt,
} from "../expenses/ExpenseStore.ts"

/**
 * The agent's tools for Drafts (PLAN, "The chat turn"): find a Category,
 * propose a Draft, change or discard it, and read an Expense to show it.
 * None confirms (ADR-0007): only the button on the card does.
 */

/** Why a tool call did nothing, in words the model can act on. Returned, not thrown. */
const ToolFailure = Schema.Struct({ message: Schema.String })
type ToolFailure = typeof ToolFailure.Type

/** An Expense as the model reads it: with its Category's name, so it never maps ids itself. */
export const ExpenseView = Schema.Struct({
  id: ExpenseId,
  status: ExpenseStatus,
  amount: Rupiah,
  categoryName: Schema.String,
  merchant: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  occurredAt: IsoDate,
  needsReview: Schema.Boolean,
})
export type ExpenseView = typeof ExpenseView.Type

/**
 * Optional free text the model fills in. Models sometimes write the word
 * "null" (or blank text) instead of a JSON null; both mean "none", so a
 * card never shows "null" as a merchant.
 */
const OptionalText = Schema.NullOr(Schema.String).annotate({
  description: 'JSON null when unknown; never the string "null" or an empty string',
})

const absentWords = new Set(["", "null", "none", "undefined", "n/a", "-"])

/** The text, trimmed, or null when the model meant "none". */
const textOrNull = (text: string | null): string | null => {
  if (text === null) return null
  const trimmed = text.trim()
  return absentWords.has(trimmed.toLowerCase()) ? null : trimmed
}

const categoryName = Schema.String.annotate({
  description: "One of the names search_categories returns",
})

export const SearchCategories = Tool.make("search_categories", {
  description: "The closed set of Categories an Expense can belong to. Pick one; never invent one.",
  success: Schema.Array(Category),
})

export const ProposeExpense = Tool.make("propose_expense", {
  description:
    "Create a Draft Expense the user can confirm on its card, and return it. Call once per Expense the user mentions; show each with DraftExpenseCard and the returned id. With a Receipt attached, the Draft holds it; proposing again from the same Receipt changes that Draft instead of adding one.",
  parameters: Schema.Struct({
    amount: Rupiah.annotate({
      description: "Whole Rupiah, e.g. 70rb is 70000. Negative for a refund.",
    }),
    merchant: OptionalText,
    occurredAt: Schema.optional(IsoDate).annotate({
      description: "YYYY-MM-DD. Omit for the user's local date today.",
    }),
    categoryName,
    note: OptionalText,
    needsReview: Schema.Boolean.annotate({
      description:
        "True when you guessed the amount, date or Category, or could not read part of a Receipt",
    }),
  }),
  success: ExpenseView,
  failure: ToolFailure,
  failureMode: "return",
})

export const UpdateDraft = Tool.make("update_draft", {
  description:
    "Change fields of a Draft Expense the user has not confirmed. Omitted fields stay as they are.",
  parameters: Schema.Struct({
    id: ExpenseId,
    amount: Schema.optional(Rupiah),
    merchant: Schema.optional(OptionalText),
    occurredAt: Schema.optional(IsoDate),
    categoryName: Schema.optional(categoryName),
    note: Schema.optional(OptionalText),
    needsReview: Schema.optional(Schema.Boolean).annotate({
      description:
        "False once the user has told you the fields you were unsure of; true if you are now unsure",
    }),
  }),
  success: ExpenseView,
  failure: ToolFailure,
  failureMode: "return",
})

export const DiscardDraft = Tool.make("discard_draft", {
  description: "Discard a Draft Expense the user no longer wants. A confirmed Expense stays.",
  parameters: Schema.Struct({ id: ExpenseId }),
  success: ExpenseView,
  failure: ToolFailure,
  failureMode: "return",
})

export const GetExpense = Tool.make("get_expense", {
  description: "Read one Expense or Draft by id, to answer about it or show it.",
  parameters: Schema.Struct({ id: ExpenseId }),
  success: ExpenseView,
  failure: ToolFailure,
  failureMode: "return",
})

export const DraftTools = Toolkit.make(
  SearchCategories,
  ProposeExpense,
  UpdateDraft,
  DiscardDraft,
  GetExpense,
)

const notFound = (id: string): ToolFailure => ({ message: `No Draft Expense has id ${id}.` })

/** What the tools know about the Chat turn they run in. */
export interface DraftTurn {
  /** The user's local date, the default for a new Draft (ADR-0009). The server never reads its own clock. */
  readonly clientDate: IsoDate
  /** The Receipt the user attached this turn; a Draft proposed in it holds that Receipt. */
  readonly receiptKey?: ReceiptKey | undefined
}

/** The handlers, per Chat turn, their store calls provided by `withStores`. */
export const draftToolHandlers = (
  withStores: Provide<SqlClient.SqlClient | ReceiptStore>,
  { clientDate, receiptKey }: DraftTurn,
) => {
  const categories = withStores(listCategories)

  /** The Category with this name, ignoring case, or a failure that lists the real ones. */
  const categoryId = (name: string) =>
    Effect.gen(function* () {
      const all = yield* categories
      const found = all.find((category) => category.name.toLowerCase() === name.toLowerCase())
      if (found !== undefined) return found.id
      const names = all.map((category) => category.name).join(", ")
      return yield* Effect.fail<ToolFailure>({
        message: `"${name}" is not a Category. Use one of: ${names}.`,
      })
    })

  const view = (expense: Expense) =>
    Effect.gen(function* () {
      const all = yield* categories
      const category = all.find((candidate) => candidate.id === expense.categoryId)
      // `category_id` references the seeded set, so a miss is a broken database, not a guess to label.
      if (category === undefined) {
        return yield* Effect.die(
          new Error(
            `Expense ${expense.id} has Category ${expense.categoryId}, which is not seeded`,
          ),
        )
      }
      return {
        id: expense.id,
        status: expense.status,
        amount: expense.amount,
        categoryName: category.name,
        merchant: expense.merchant,
        note: expense.note,
        occurredAt: expense.occurredAt,
        needsReview: expense.needsReview,
      } satisfies ExpenseView
    })

  return DraftTools.of({
    search_categories: () => categories,

    propose_expense: (params) =>
      Effect.gen(function* () {
        const input = {
          amount: params.amount,
          categoryId: yield* categoryId(params.categoryName),
          merchant: textOrNull(params.merchant),
          note: textOrNull(params.note),
          occurredAt: params.occurredAt ?? clientDate,
        }
        const draft = yield* withStores(
          receiptKey === undefined
            ? insertExpense(input, { status: "draft", needsReview: params.needsReview })
            : proposeFromReceipt(input, { receiptKey, needsReview: params.needsReview }),
        ).pipe(
          Effect.catchTags({
            ExpenseConfirmed: ({ id }) =>
              Effect.fail<ToolFailure>({
                message: `This Receipt is already recorded as Expense ${id}; show that one instead.`,
              }),
            // `categoryId` resolved the name against the same closed set.
            UnknownCategory: Effect.die,
          }),
        )
        return yield* view(draft)
      }),

    update_draft: ({ id, categoryName: name, merchant, note, ...fields }) =>
      Effect.gen(function* () {
        const edit: EditExpense = {
          ...fields,
          ...(merchant !== undefined && { merchant: textOrNull(merchant) }),
          ...(note !== undefined && { note: textOrNull(note) }),
          ...(name !== undefined && { categoryId: yield* categoryId(name) }),
        }
        const draft = yield* withStores(editExpense(id, edit, ["draft"])).pipe(
          Effect.catchTags({
            ExpenseNotFound: () => Effect.fail(notFound(id)),
            // `categoryId` resolved the name against the same closed set.
            UnknownCategory: Effect.die,
          }),
        )
        return yield* view(draft)
      }),

    discard_draft: ({ id }) =>
      withStores(discardExpense(id)).pipe(
        Effect.catchTags({
          ExpenseNotFound: () => Effect.fail(notFound(id)),
          ExpenseConfirmed: () =>
            Effect.fail<ToolFailure>({
              message: `Expense ${id} is already confirmed; only the user can delete it.`,
            }),
        }),
        Effect.flatMap(view),
      ),

    get_expense: ({ id }) =>
      Effect.gen(function* () {
        const found = yield* withStores(findExpense(id))
        if (Option.isNone(found)) {
          return yield* Effect.fail<ToolFailure>({ message: `No Expense has id ${id}.` })
        }
        return yield* view(found.value)
      }),
  })
}
