import { Effect } from "effect"
import { Toolkit } from "effect/ai"
import { QuerySpending, QuerySpendingHandler } from "../reports/QuerySpending.ts"

/** The tools the model may call in a Chat turn (PLAN, "The chat turn"). No confirm tool (ADR-0007). */
export const ChatToolkit = Toolkit.make(QuerySpending)
export type ChatTools = Toolkit.Tools<typeof ChatToolkit>

/** The handlers, built once with the services they need, so a turn provides nothing per call. */
export const ChatToolkitLive = ChatToolkit.toLayer(
  Effect.gen(function* () {
    return { query_spending: yield* QuerySpendingHandler }
  }),
)
