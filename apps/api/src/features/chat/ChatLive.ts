import { Api, ChatHistoryPageSize, chatMessageIdHeader, type ReceiptKey } from "@expense/contract"
import { Effect, Stream } from "effect"
import { LanguageModel } from "effect/ai"
import { HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { captureServices } from "../../captureServices.ts"
import { ReceiptStore } from "../receipts/ReceiptStore.ts"
import { findExpenses } from "../expenses/ExpenseStore.ts"
import { draftForUnreadReceipt, loadTurnReceipt } from "../receipts/TurnReceipt.ts"
import { makeChatHistory } from "./ChatHistory.ts"
import { makeChatToolkit } from "./ChatToolkit.ts"
import { runChatTurn } from "./ChatTurn.ts"
import { rerenderMessage } from "./Rerender.ts"

/**
 * `POST /api/chat` streams a reply; `GET /api/chat` pages the Chat, newest
 * first; `POST /api/chat/:messageId/rerender` redraws a reply's program.
 */
export const ChatLive = HttpApiBuilder.group(Api, "chat", (handlers) =>
  Effect.gen(function* () {
    const history = yield* makeChatHistory
    const model = yield* LanguageModel.LanguageModel
    const toolkitFor = yield* makeChatToolkit
    const withStores = yield* captureServices(SqlClient.SqlClient, ReceiptStore)

    const receiptFor = (key: ReceiptKey | undefined) =>
      key === undefined ? Effect.succeed(undefined) : withStores(loadTurnReceipt(key))

    return handlers
      .handle("send", ({ payload }) =>
        Effect.gen(function* () {
          const receipt = yield* receiptFor(payload.receiptKey)
          const toolkit = yield* toolkitFor(payload)
          const afterModel =
            receipt === undefined
              ? undefined
              : (reply: string) =>
                  withStores(draftForUnreadReceipt(receipt.key, payload.clientDate, reply))
          const turn = yield* runChatTurn(
            {
              model,
              history,
              toolkit,
              afterModel,
              findExpenses: (ids) => withStores(findExpenses(ids)),
            },
            payload,
            receipt,
          )
          return HttpServerResponse.stream(Stream.encodeText(turn.reply), {
            contentType: "text/plain; charset=utf-8",
            headers: { [chatMessageIdHeader]: turn.messageId },
          })
        }),
      )
      .handle("history", ({ query }) =>
        history.page({ before: query.before, limit: query.limit ?? ChatHistoryPageSize.default }),
      )
      .handle("rerender", ({ params }) => rerenderMessage({ model, history }, params.messageId))
  }),
)
