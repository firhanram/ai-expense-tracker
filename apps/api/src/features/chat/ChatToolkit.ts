import { Effect } from "effect"
import { Toolkit } from "effect/ai"
import { SqlClient } from "effect/sql"
import { captureServices } from "../../captureServices.ts"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"
import { QuerySpending, QuerySpendingHandler } from "../reports/QuerySpending.ts"
import { type DraftTurn, DraftTools, draftToolHandlers } from "./DraftTools.ts"

/**
 * Every tool the model may call in a Chat turn (PLAN, "The chat turn"). A new
 * group of tools is one more toolkit merged here and its handlers added below.
 * No confirm tool (ADR-0007): `record-expense.test.ts` asserts it.
 */
export const ChatToolkit = Toolkit.merge(DraftTools, Toolkit.make(QuerySpending))
export type ChatTools = Toolkit.Tools<typeof ChatToolkit>

/**
 * Builds the handlers once with the services they need and returns, per
 * turn, the toolkit bound to that turn: its client date, which a new Draft
 * defaults to (ADR-0009), and the Receipt it carries, which a Draft holds.
 */
export const makeChatToolkit = Effect.gen(function* () {
  const withStores = yield* captureServices(SqlClient.SqlClient, ReceiptStore)
  const querySpending = yield* QuerySpendingHandler
  return (turn: DraftTurn) =>
    ChatToolkit.pipe(
      Effect.provide(
        ChatToolkit.toLayer({
          ...draftToolHandlers(withStores, turn),
          query_spending: querySpending,
        }),
      ),
    )
})
