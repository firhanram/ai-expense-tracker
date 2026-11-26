import type { IsoDate } from "@expense/contract"
import { Effect } from "effect"
import { Toolkit } from "effect/ai"
import type { SqlClient } from "effect/sql"
import { DraftTools, draftToolHandlers } from "./DraftTools.ts"

/**
 * Every tool the Chat's model may call. A new group of tools (e.g. spending
 * queries, #13) is one more toolkit merged here and its handlers added below.
 * Never a confirm tool (ADR-0007): `record-expense.test.ts` asserts it.
 */
export const ChatToolkit = Toolkit.merge(DraftTools)
export type ChatTools = Toolkit.Tools<typeof ChatToolkit>

/** The toolkit with its handlers, built per turn because they need the client's date. */
export const makeChatToolkit = (sql: SqlClient.SqlClient, clientDate: IsoDate) =>
  ChatToolkit.pipe(
    Effect.provide(
      ChatToolkit.toLayer({
        ...draftToolHandlers(sql, clientDate),
      }),
    ),
  )
