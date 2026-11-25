import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { CategoryId, CreateExpense, Expense, ListExpensesQuery } from "./Expense.ts"

/** The Category id is not one of the seeded set (ADR-0004). */
export class UnknownCategory extends Schema.TaggedError<UnknownCategory>()(
  "UnknownCategory",
  { categoryId: CategoryId },
  { httpApiStatus: 400 },
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
) {}
