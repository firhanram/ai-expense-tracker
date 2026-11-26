import type { IsoDate } from "@expense/contract"
import { Effect } from "effect"
import { Toolkit } from "effect/ai"
import { SqlClient } from "effect/sql"
import { QuerySpending, QuerySpendingHandler } from "../reports/QuerySpending.ts"
import { DraftTools, draftToolHandlers } from "./DraftTools.ts"

/**
 * Every tool the model may call in a Chat turn (PLAN, "The chat turn"). A new
 * group of tools is one more toolkit merged here and its handlers added below.
 * No confirm tool (ADR-0007): `record-expense.test.ts` asserts it.
 */
export const ChatToolkit = Toolkit.merge(DraftTools, Toolkit.make(QuerySpending))
export type ChatTools = Toolkit.Tools<typeof ChatToolkit>

/**
 * Builds the handlers once with the services they need and returns, per
 * turn, the toolkit bound to that turn's client date: a new Draft defaults
 * to it (ADR-0009).
 */
export const makeChatToolkit = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const querySpending = yield* QuerySpendingHandler
  return (clientDate: IsoDate) =>
    ChatToolkit.pipe(
      Effect.provide(
        ChatToolkit.toLayer({
          ...draftToolHandlers(sql, clientDate),
          query_spending: querySpending,
        }),
      ),
    )
})
