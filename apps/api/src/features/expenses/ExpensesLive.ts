import { Api } from "@expense/contract"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { captureServices } from "../../captureServices.ts"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"
import {
  confirmExpense,
  deleteExpense,
  discardExpense,
  editExpense,
  getExpense,
  insertExpense,
  listExpenses,
} from "./ExpenseStore.ts"

export const ExpensesLive = HttpApiBuilder.group(Api, "expenses", (handlers) =>
  Effect.gen(function* () {
    const withStores = yield* captureServices(SqlClient.SqlClient, ReceiptStore)

    return handlers
      .handle("list", ({ query }) => withStores(listExpenses(query)))
      .handle("get", ({ params }) => withStores(getExpense(params.id)))
      .handle("create", ({ payload }) =>
        withStores(insertExpense(payload, { status: "confirmed" })),
      )
      .handle("confirm", ({ params }) => withStores(confirmExpense(params.id)))
      .handle("discard", ({ params }) => withStores(discardExpense(params.id)))
      .handle("edit", ({ params, payload }) => withStores(editExpense(params.id, payload)))
      .handle("remove", ({ params }) => withStores(deleteExpense(params.id)).pipe(Effect.as(null)))
  }),
)
