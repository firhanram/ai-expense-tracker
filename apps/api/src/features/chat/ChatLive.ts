import { Api, ChatHistoryPageSize } from "@expense/contract"
import { Effect, Stream } from "effect"
import { LanguageModel } from "effect/ai"
import { HttpApiBuilder } from "effect/http-api"
import { makeChatHistory } from "./ChatHistory.ts"
import { makeChatToolkit } from "./ChatToolkit.ts"
import { runChatTurn } from "./ChatTurn.ts"

/** `POST /api/chat` streams a reply; `GET /api/chat` pages the Chat, newest first. */
export const ChatLive = HttpApiBuilder.group(Api, "chat", (handlers) =>
  Effect.gen(function* () {
    const history = yield* makeChatHistory
    const model = yield* LanguageModel.LanguageModel
    const toolkitFor = yield* makeChatToolkit
    return handlers
      .handle("send", ({ payload }) =>
        toolkitFor(payload.clientDate).pipe(
          Effect.flatMap((toolkit) => runChatTurn({ model, history, toolkit }, payload)),
          Effect.map(Stream.encodeText),
        ),
      )
      .handle("history", ({ query }) =>
        history.page({ before: query.before, limit: query.limit ?? ChatHistoryPageSize.default }),
      )
  }),
)
