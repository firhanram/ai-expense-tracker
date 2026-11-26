import { type ChatMessage, ModelUnreachable, type SendChatMessage } from "@expense/contract"
import { joinReply, splitReply } from "@expense/ui/server"
import { Effect, Exit, Option, Scope, Sink, Stream } from "effect"
import { type AiError, LanguageModel, type Prompt, type Response, type Toolkit } from "effect/ai"
import { runAgentLoop } from "./AgentLoop.ts"
import type { NewChatMessage } from "./ChatHistory.ts"
import type { ChatTools } from "./ChatToolkit.ts"
import { draftsShown } from "./DraftShown.ts"
import { SystemPrompt } from "./SystemPrompt.ts"

/** How much of the Chat the model sees each turn. */
export const contextMessages = 20

/**
 * The prompt for one turn: the system prompt, the recent Chat, then the
 * client's date and the new message. The date sits after the history so
 * the prefix stays cacheable across days (ADR-0008, ADR-0009). Earlier
 * replies carry their programs, so the model sees the ids it rendered.
 */
export const buildPrompt = (
  systemPrompt: string,
  history: ReadonlyArray<ChatMessage>,
  request: SendChatMessage,
): Array<Prompt.MessageEncoded> => [
  { role: "system", content: systemPrompt },
  ...history.map((message): Prompt.MessageEncoded =>
    message.role === "user"
      ? { role: "user", content: [{ type: "text", text: message.content }] }
      : { role: "assistant", content: [{ type: "text", text: joinReply(message) }] },
  ),
  { role: "system", content: `The user's local date today is ${request.clientDate}.` },
  { role: "user", content: [{ type: "text", text: request.message }] },
]

const toUnreachable = (error: AiError.AiError) =>
  // oxlint-disable-next-line no-underscore-dangle -- `_tag` is how Effect names an error's kind.
  new ModelUnreachable({ reason: error.reason._tag })

/**
 * Waits for the first piece of prose so a model that cannot be reached is a
 * typed `ModelUnreachable` (503) rather than a 200 whose body is cut off.
 * The remainder streams in a scope this owns, closed when it ends.
 */
const firstChunk = <E>(prose: Stream.Stream<string, E>) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const [head, rest] = yield* Stream.peel(prose, Sink.head<string>()).pipe(
      Scope.provide(scope),
      Effect.onError(() => Scope.close(scope, Exit.void)),
    )
    return { head, rest: rest.pipe(Stream.ensuring(Scope.close(scope, Exit.void))) }
  })

export interface ChatTurnDeps {
  readonly model: LanguageModel.LanguageModel
  readonly history: {
    readonly recent: (count: number) => Effect.Effect<ReadonlyArray<ChatMessage>>
    readonly append: (message: NewChatMessage) => Effect.Effect<void>
  }
  /** The agent's tools, their handlers bound to this turn's client date. */
  readonly toolkit: Toolkit.WithHandler<ChatTools>
}

/**
 * One Chat turn (PLAN, "The chat turn"): store the user message, run the
 * agent loop, stream its text as written (prose and any OpenUI Lang program
 * together), and store the reply once it is complete, split into prose
 * (`content`) and program (`ui_text`). The program is stored unvalidated:
 * parsing it here would load OpenUI into the Worker, and the client parses
 * it anyway, falling back to the prose when it fails.
 * An empty reply is a 200 with an empty body, and is stored as such. A model
 * failure after the first word ends the stream and stores no reply.
 */
export const runChatTurn = (deps: ChatTurnDeps, request: SendChatMessage) =>
  Effect.gen(function* () {
    const history = yield* deps.history.recent(contextMessages)
    yield* deps.history.append({ role: "user", content: request.message })

    const systemPrompt = yield* SystemPrompt
    const prose = runAgentLoop({
      prompt: buildPrompt(systemPrompt, history, request),
      toolkit: deps.toolkit,
      stopAfter: draftsShown(),
    }).pipe(
      Stream.filter((part): part is Response.TextDeltaPart => part.type === "text-delta"),
      Stream.map((part) => part.delta),
      Stream.filter((delta) => delta.length > 0),
      Stream.provideService(LanguageModel.LanguageModel, deps.model),
    )

    const { head, rest } = yield* firstChunk(prose).pipe(Effect.mapError(toUnreachable))

    let reply = ""
    const storeReply = Effect.suspend(() =>
      deps.history.append({ role: "assistant", ...splitReply(reply) }),
    )
    if (Option.isNone(head)) {
      yield* storeReply
      return Stream.empty
    }
    return Stream.concat(Stream.make(head.value), rest).pipe(
      Stream.tap((chunk) => Effect.sync(() => (reply += chunk))),
      Stream.onEnd(storeReply),
      Stream.tapError((error) => Effect.logError("Chat reply failed mid-stream", error)),
    )
  })
