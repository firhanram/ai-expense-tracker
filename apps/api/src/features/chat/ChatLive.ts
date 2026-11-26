import { Api, ChatHistoryPageSize } from "@expense/contract"
import { Effect, Layer, Stream } from "effect"
import { LanguageModel } from "effect/ai"
import { HttpApiBuilder } from "effect/http-api"
import { makeChatHistory } from "./ChatHistory.ts"
import { ChatToolkit, ChatToolkitLive } from "./ChatToolkit.ts"
import { runChatTurn } from "./ChatTurn.ts"

/** `POST /api/chat` streams a reply; `GET /api/chat` pages the Chat, newest first. */
export const ChatLive = HttpApiBuilder.group(Api, "chat", (handlers) =>
  Effect.gen(function* () {
    const history = yield* makeChatHistory
    const model = yield* LanguageModel.LanguageModel
    const toolkit = yield* ChatToolkit
    return handlers
      .handle("send", ({ payload }) =>
        runChatTurn({ model, history, toolkit }, payload).pipe(Effect.map(Stream.encodeText)),
      )
      .handle("history", ({ query }) =>
        history.page({ before: query.before, limit: query.limit ?? ChatHistoryPageSize.default }),
      )
  }),
).pipe(Layer.provide(ChatToolkitLive))
