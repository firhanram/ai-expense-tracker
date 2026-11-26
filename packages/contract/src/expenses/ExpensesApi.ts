import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { apiError, errorIdField, ok, okNull } from "../ApiResponse.ts"
import {
  CategoryId,
  CreateExpense,
  EditExpense,
  Expense,
  ExpenseId,
  ListExpensesQuery,
} from "./Expense.ts"

/** The Category id is not one of the seeded set (ADR-0004). */
export class UnknownCategory extends Schema.TaggedError<UnknownCategory>()("UnknownCategory", {
  categoryId: CategoryId,
  ...errorIdField,
}) {}

/** No Expense the route can act on has this id. */
export class ExpenseNotFound extends Schema.TaggedError<ExpenseNotFound>()("ExpenseNotFound", {
  id: ExpenseId,
  ...errorIdField,
}) {}

/** A discarded Expense cannot be confirmed; the agent proposes a new Draft instead. */
export class ExpenseDiscarded extends Schema.TaggedError<ExpenseDiscarded>()("ExpenseDiscarded", {
  id: ExpenseId,
  ...errorIdField,
}) {}

/** A confirmed Expense cannot be discarded; deleting it is the way to remove it. */
export class ExpenseConfirmed extends Schema.TaggedError<ExpenseConfirmed>()("ExpenseConfirmed", {
  id: ExpenseId,
  ...errorIdField,
}) {}

const unknownCategory = apiError(
  UnknownCategory,
  "UNKNOWN_CATEGORY",
  (e) => `No Category has the id ${e.categoryId}.`,
)
const expenseNotFound = apiError(
  ExpenseNotFound,
  "EXPENSE_NOT_FOUND",
  (e) => `No Expense has the id ${e.id}.`,
)
const expenseDiscarded = apiError(
  ExpenseDiscarded,
  "EXPENSE_DISCARDED",
  () => "This Expense was discarded and cannot be confirmed.",
)
const expenseConfirmed = apiError(
  ExpenseConfirmed,
  "EXPENSE_CONFIRMED",
  () => "This Expense is confirmed and cannot be discarded; delete it instead.",
)

export class ExpensesGroup extends HttpApiGroup.make("expenses").add(
  HttpApiEndpoint.get("list", "/expenses", {
    query: ListExpensesQuery,
    success: ok(Schema.Array(Expense)),
  }),
  HttpApiEndpoint.post("create", "/expenses", {
    payload: CreateExpense,
    success: ok(Expense).pipe(HttpApiSchema.status(201)),
    error: unknownCategory,
  }),
  /** Draft to confirmed. Idempotent: confirming a confirmed Expense returns it unchanged (ADR-0007). */
  HttpApiEndpoint.post("confirm", "/expenses/:id/confirm", {
    params: { id: ExpenseId },
    success: ok(Expense),
    error: [expenseNotFound, expenseDiscarded],
  }),
  /** Draft to discarded, keeping the row (ADR-0002). Idempotent like confirm. */
  HttpApiEndpoint.post("discard", "/expenses/:id/discard", {
    params: { id: ExpenseId },
    success: ok(Expense),
    error: [expenseNotFound, expenseConfirmed],
  }),
  HttpApiEndpoint.patch("edit", "/expenses/:id", {
    params: { id: ExpenseId },
    payload: EditExpense,
    success: ok(Expense),
    error: [expenseNotFound, unknownCategory],
  }),
  HttpApiEndpoint.delete("remove", "/expenses/:id", {
    params: { id: ExpenseId },
    success: okNull,
    error: expenseNotFound,
  }),
) {}
