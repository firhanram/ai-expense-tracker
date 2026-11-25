import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { CategoryId, CreateExpense, EditExpense, Expense, ListExpensesQuery } from "./Expense.ts"

/** The Category id is not one of the seeded set (ADR-0004). */
export class UnknownCategory extends Schema.TaggedError<UnknownCategory>()(
  "UnknownCategory",
  { categoryId: CategoryId },
  { httpApiStatus: 400 },
) {}

/** No Expense the route can act on has this id. */
export class ExpenseNotFound extends Schema.TaggedError<ExpenseNotFound>()(
  "ExpenseNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
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
  HttpApiEndpoint.patch("edit", "/expenses/:id", {
    params: { id: Schema.String },
    payload: EditExpense,
    success: Expense,
    error: [ExpenseNotFound, UnknownCategory],
  }),
  HttpApiEndpoint.delete("remove", "/expenses/:id", {
    params: { id: Schema.String },
    error: ExpenseNotFound,
  }),
) {}
