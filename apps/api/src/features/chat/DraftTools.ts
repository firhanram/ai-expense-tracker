import { type EditExpense, type Expense, IsoDate, Rupiah } from "@expense/contract"
import { Effect, Schema } from "effect"
import { Tool, Toolkit } from "effect/ai"
import { SqlClient } from "effect/sql"
import { editExpense } from "../expenses/editExpense.ts"
import { decodeRows, toExpense } from "../expenses/ExpenseRow.ts"
import { discardExpense, insertExpense, proposeFromReceipt } from "../expenses/ExpenseStore.ts"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"

/**
 * The agent's tools for Drafts (PLAN, "The chat turn"): find a Category,
 * propose a Draft, change or discard it, and read an Expense to show it.
 * None confirms (ADR-0007): only the button on the card does.
 */

/** Why a tool call did nothing, in words the model can act on. Returned, not thrown. */
const ToolFailure = Schema.Struct({ message: Schema.String })
type ToolFailure = typeof ToolFailure.Type

const Category = Schema.Struct({ id: Schema.Int, name: Schema.String })

/** An Expense as the model reads it: with its Category's name, so it never maps ids itself. */
export const ExpenseView = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  amount: Schema.Int,
  categoryName: Schema.String,
  merchant: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  occurredAt: Schema.String,
  needsReview: Schema.Boolean,
})
export type ExpenseView = typeof ExpenseView.Type

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
    merchant: Schema.NullOr(Schema.String),
    occurredAt: Schema.optional(IsoDate).annotate({
      description: "YYYY-MM-DD. Omit for the user's local date today.",
    }),
    categoryName,
    note: Schema.NullOr(Schema.String),
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
    id: Schema.String,
    amount: Schema.optional(Rupiah),
    merchant: Schema.optional(Schema.NullOr(Schema.String)),
    occurredAt: Schema.optional(IsoDate),
    categoryName: Schema.optional(categoryName),
    note: Schema.optional(Schema.NullOr(Schema.String)),
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
  parameters: Schema.Struct({ id: Schema.String }),
  success: ExpenseView,
  failure: ToolFailure,
  failureMode: "return",
})

export const GetExpense = Tool.make("get_expense", {
  description: "Read one Expense or Draft by id, to answer about it or show it.",
  parameters: Schema.Struct({ id: Schema.String }),
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

const decodeCategories = Schema.decodeUnknownEffect(Schema.Array(Category))

const notFound = (id: string): ToolFailure => ({ message: `No Draft Expense has id ${id}.` })

/** What the tools know about the Chat turn they run in. */
export interface DraftTurn {
  /** The user's local date, the default for a new Draft (ADR-0009). The server never reads its own clock. */
  readonly clientDate: IsoDate
  /** The Receipt the user attached this turn; a Draft proposed in it holds that Receipt. */
  readonly receiptKey?: string | undefined
}

/** The handlers, per Chat turn. */
export const draftToolHandlers = (
  sql: SqlClient.SqlClient,
  receipts: ReceiptStore["Service"],
  { clientDate, receiptKey }: DraftTurn,
) => {
  const categories = sql`SELECT id, name FROM category ORDER BY sort_order`.pipe(
    Effect.flatMap(decodeCategories),
    Effect.orDie,
  )

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
    categories.pipe(
      Effect.map((all) => ({
        id: expense.id,
        status: expense.status,
        amount: expense.amount,
        categoryName: all.find((category) => category.id === expense.categoryId)?.name ?? "Other",
        merchant: expense.merchant,
        note: expense.note,
        occurredAt: expense.occurredAt,
        needsReview: expense.needsReview,
      })),
    )

  const withSql = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | ReceiptStore>) =>
    effect.pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.provideService(ReceiptStore, receipts),
    )

  return DraftTools.of({
    search_categories: () => categories,

    propose_expense: (params) =>
      Effect.gen(function* () {
        const input = {
          amount: params.amount,
          categoryId: yield* categoryId(params.categoryName),
          merchant: params.merchant,
          note: params.note,
          occurredAt: params.occurredAt ?? clientDate,
        }
        const draft = yield* withSql(
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

    update_draft: ({ id, categoryName: name, ...fields }) =>
      Effect.gen(function* () {
        const edit: EditExpense = {
          ...fields,
          ...(name !== undefined && { categoryId: yield* categoryId(name) }),
        }
        const draft = yield* editExpense(sql, id, edit, ["draft"]).pipe(
          Effect.catchTags({
            ExpenseNotFound: () => Effect.fail(notFound(id)),
            // `categoryId` resolved the name against the same closed set.
            UnknownCategory: Effect.die,
          }),
        )
        return yield* view(draft)
      }),

    discard_draft: ({ id }) =>
      withSql(discardExpense(id)).pipe(
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
        const [row] = yield* sql`SELECT * FROM expense WHERE id = ${id}`.pipe(
          Effect.flatMap(decodeRows),
          Effect.orDie,
        )
        if (row === undefined) {
          return yield* Effect.fail<ToolFailure>({ message: `No Expense has id ${id}.` })
        }
        return yield* view(toExpense(row))
      }),
  })
}
