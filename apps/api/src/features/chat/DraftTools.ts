import { type EditExpense, type Expense, IsoDate, Rupiah } from "@expense/contract"
import { Effect, Schema } from "effect"
import { Tool, Toolkit } from "effect/ai"
import { SqlClient } from "effect/sql"
import { editExpense } from "../expenses/editExpense.ts"
import { discardExpense, insertExpense } from "../expenses/ExpenseStore.ts"
import { decodeRows, toExpense } from "../expenses/ExpenseRow.ts"

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
const ExpenseView = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  amount: Schema.Int,
  categoryName: Schema.String,
  merchant: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  occurredAt: Schema.String,
  needsReview: Schema.Boolean,
})

const categoryName = Schema.String.annotate({
  description: "One of the names search_categories returns",
})

export const SearchCategories = Tool.make("search_categories", {
  description: "The closed set of Categories an Expense can belong to. Pick one; never invent one.",
  success: Schema.Array(Category),
})

export const ProposeExpense = Tool.make("propose_expense", {
  description:
    "Create a Draft Expense the user can confirm on its card, and return it. Call once per Expense the user mentions; show each with DraftExpenseCard and the returned id.",
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
      description: "True when you guessed the amount, date or Category",
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

/**
 * The handlers, per Chat turn: `clientDate` is the user's local date, the
 * default for a new Draft (ADR-0009). The server never reads its own clock.
 */
export const draftToolHandlers = (sql: SqlClient.SqlClient, clientDate: IsoDate) => {
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

  const withSql = Effect.provideService(SqlClient.SqlClient, sql)

  return DraftTools.of({
    search_categories: () => categories,

    propose_expense: (params) =>
      Effect.gen(function* () {
        const id = yield* categoryId(params.categoryName)
        const draft = yield* withSql(
          insertExpense(
            {
              amount: params.amount,
              categoryId: id,
              merchant: params.merchant,
              note: params.note,
              occurredAt: params.occurredAt ?? clientDate,
            },
            { status: "draft", needsReview: params.needsReview },
          ),
        ).pipe(Effect.orDie)
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
