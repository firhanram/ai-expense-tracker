import { Api, ChatHistoryPageSize } from "@expense/contract"
import { Effect, Stream } from "effect"
import { LanguageModel } from "effect/ai"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"
import { draftForUnreadReceipt, loadTurnReceipt } from "../receipts/TurnReceipt.ts"
import { makeChatHistory } from "./ChatHistory.ts"
import { makeChatToolkit } from "./ChatToolkit.ts"
import { runChatTurn } from "./ChatTurn.ts"

/** `POST /api/chat` streams a reply; `GET /api/chat` pages the Chat, newest first. */
export const ChatLive = HttpApiBuilder.group(Api, "chat", (handlers) =>
  Effect.gen(function* () {
    const history = yield* makeChatHistory
    const model = yield* LanguageModel.LanguageModel
    const toolkitFor = yield* makeChatToolkit
    const sql = yield* SqlClient.SqlClient
    const receipts = yield* ReceiptStore

    const receiptFor = (key: string | undefined) =>
      key === undefined
        ? Effect.succeed(undefined)
        : loadTurnReceipt(key).pipe(
            Effect.provideService(SqlClient.SqlClient, sql),
            Effect.provideService(ReceiptStore, receipts),
          )

    return handlers
      .handle("send", ({ payload }) =>
        Effect.gen(function* () {
          const receipt = yield* receiptFor(payload.receiptKey)
          const toolkit = yield* toolkitFor(payload)
          const afterModel =
            receipt === undefined
              ? undefined
              : (reply: string) =>
                  draftForUnreadReceipt(receipt.key, payload.clientDate, reply).pipe(
                    Effect.provideService(SqlClient.SqlClient, sql),
                  )
          const turn = yield* runChatTurn({ model, history, toolkit, afterModel }, payload, receipt)
          return Stream.encodeText(turn)
        }),
      )
      .handle("history", ({ query }) =>
        history.page({ before: query.before, limit: query.limit ?? ChatHistoryPageSize.default }),
      )
  }),
)
