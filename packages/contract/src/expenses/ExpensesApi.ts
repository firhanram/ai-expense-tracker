import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import {
  CategoryId,
  CreateExpense,
  EditExpense,
  Expense,
  ExpenseId,
  ListExpensesQuery,
} from "./Expense.ts"

/** The Category id is not one of the seeded set (ADR-0004). */
export class UnknownCategory extends Schema.TaggedError<UnknownCategory>()(
  "UnknownCategory",
  { categoryId: CategoryId },
  { httpApiStatus: 400 },
) {}

/** No Expense the route can act on has this id. */
export class ExpenseNotFound extends Schema.TaggedError<ExpenseNotFound>()(
  "ExpenseNotFound",
  { id: ExpenseId },
  { httpApiStatus: 404 },
) {}

/** A discarded Expense cannot be confirmed; the agent proposes a new Draft instead. */
export class ExpenseDiscarded extends Schema.TaggedError<ExpenseDiscarded>()(
  "ExpenseDiscarded",
  { id: ExpenseId },
  { httpApiStatus: 409 },
) {}

/** A confirmed Expense cannot be discarded; deleting it is the way to remove it. */
export class ExpenseConfirmed extends Schema.TaggedError<ExpenseConfirmed>()(
  "ExpenseConfirmed",
  { id: ExpenseId },
  { httpApiStatus: 409 },
) {}

export class ExpensesGroup extends HttpApiGroup.make("expenses").add(
  HttpApiEndpoint.get("list", "/expenses", {
    query: ListExpensesQuery,
    success: Schema.Array(Expense),
  }),
  HttpApiEndpoint.post("create", "/expenses", {
    payload: CreateExpense,
    success: Expense.pipe(HttpApiSchema.status(201)),
    error: UnknownCategory,
  }),
  /** Draft to confirmed. Idempotent: confirming a confirmed Expense returns it unchanged (ADR-0007). */
  HttpApiEndpoint.post("confirm", "/expenses/:id/confirm", {
    params: { id: ExpenseId },
    success: Expense,
    error: [ExpenseNotFound, ExpenseDiscarded],
  }),
  /** Draft to discarded, keeping the row (ADR-0002). Idempotent like confirm. */
  HttpApiEndpoint.post("discard", "/expenses/:id/discard", {
    params: { id: ExpenseId },
    success: Expense,
    error: [ExpenseNotFound, ExpenseConfirmed],
  }),
  HttpApiEndpoint.patch("edit", "/expenses/:id", {
    params: { id: ExpenseId },
    payload: EditExpense,
    success: Expense,
    error: [ExpenseNotFound, UnknownCategory],
  }),
  HttpApiEndpoint.delete("remove", "/expenses/:id", {
    params: { id: ExpenseId },
    error: ExpenseNotFound,
  }),
) {}
