import { type ChatMessage, MessageNotFound, RerenderFailed } from "@expense/contract"
import { checkRedraw, joinReply, splitReply } from "@expense/ui/server"
import { Effect, Option, Stream } from "effect"
import { LanguageModel, type Prompt } from "effect/ai"
import { toUnreachable } from "./ChatTurn.ts"
import { SystemPrompt } from "./SystemPrompt.ts"

const instruction = [
  "Your reply above could not be drawn: its openui-lang program is not valid.",
  "Rewrite it as one valid openui-lang program in a fenced block.",
  "Use only the ids already in that reply; you have no tools and must not invent one.",
  "Write nothing but the program.",
].join(" ")

const rerenderPrompt = (
  systemPrompt: string,
  message: ChatMessage,
): Array<Prompt.MessageEncoded> => [
  { role: "system", content: systemPrompt },
  { role: "assistant", content: [{ type: "text", text: joinReply(message) }] },
  { role: "user", content: [{ type: "text", text: instruction }] },
]

export interface RerenderDeps {
  readonly model: LanguageModel.LanguageModel
  readonly history: {
    readonly find: (id: string) => Effect.Effect<Option.Option<ChatMessage>>
    readonly setUiText: (id: string, uiText: string | null) => Effect.Effect<void>
  }
}

/**
 * Redraws a stored assistant reply whose program cannot be drawn (PLAN,
 * "Failure path"): the model, offered no tools, rewrites the reply's prose
 * and program as a program using only the ids already in it. A rewrite that
 * passes `checkRedraw` (the library's check, without OpenUI, which cannot
 * load in the Worker) replaces the message's `uiText`; its `content` stays. The user's message is never sent again, so no Draft is proposed.
 */
export const rerenderMessage = (deps: RerenderDeps, id: string) =>
  Effect.gen(function* () {
    const found = yield* deps.history.find(id)
    if (Option.isNone(found) || found.value.role !== "assistant") {
      return yield* new MessageNotFound({ id })
    }
    const message = found.value

    const systemPrompt = yield* SystemPrompt
    const text = yield* LanguageModel.streamText({
      prompt: rerenderPrompt(systemPrompt, message),
    }).pipe(
      Stream.filter((part) => part.type === "text-delta"),
      Stream.map((part) => part.delta),
      Stream.mkString,
      Effect.provideService(LanguageModel.LanguageModel, deps.model),
      Effect.mapError(toUnreachable),
    )

    const uiText = splitReply(text).uiText
    const problems = uiText === null ? ["no program"] : checkRedraw(uiText, joinReply(message))
    if (uiText === null || problems.length > 0) {
      yield* Effect.logWarning("Re-render rejected", { id, problems })
      return yield* new RerenderFailed({ problems })
    }

    yield* deps.history.setUiText(id, uiText)
    return { ...message, uiText }
  })
