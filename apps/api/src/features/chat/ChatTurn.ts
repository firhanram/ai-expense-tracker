import { type ChatMessage, ModelUnreachable, type SendChatMessage } from "@expense/contract"
import { joinReply, splitReply } from "@expense/ui/server"
import { type Cause, Effect, Exit, Option, Queue, Scope, Sink, Stream } from "effect"
import { type AiError, LanguageModel, type Prompt, type Response, type Toolkit } from "effect/ai"
import { receiptNote, type TurnReceipt } from "../receipts/TurnReceipt.ts"
import { WaitUntil } from "../../WaitUntil.ts"
import { type AgentLoopError, runAgentLoop } from "./AgentLoop.ts"
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
 * A Receipt rides on the new message as an image (PLAN, "The chat turn"),
 * with a note saying which Draft, if any, it already became.
 */
export const buildPrompt = (
  systemPrompt: string,
  history: ReadonlyArray<ChatMessage>,
  request: SendChatMessage,
  receipt?: TurnReceipt,
): Array<Prompt.MessageEncoded> => [
  { role: "system", content: systemPrompt },
  ...history.map((message): Prompt.MessageEncoded =>
    message.role === "user"
      ? { role: "user", content: [{ type: "text", text: message.content }] }
      : { role: "assistant", content: [{ type: "text", text: joinReply(message) }] },
  ),
  { role: "system", content: `The user's local date today is ${request.clientDate}.` },
  ...(receipt === undefined ? [] : [{ role: "system", content: receiptNote(receipt) } as const]),
  {
    role: "user",
    content: [
      { type: "text", text: request.message },
      ...(receipt === undefined
        ? []
        : [
            {
              type: "file",
              mediaType: receipt.image.contentType,
              data: receipt.image.bytes,
            } as const,
          ]),
    ],
  },
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
  /**
   * Run once the model has stopped, whether it finished or failed after its
   * first word, with the reply so far; text it returns is appended to the
   * reply, streamed and stored like the model's own. A Receipt turn uses it
   * to guarantee the Receipt a Draft (`draftForUnreadReceipt`).
   */
  readonly afterModel?: ((reply: string) => Effect.Effect<string>) | undefined
}

/**
 * One Chat turn (PLAN, "The chat turn"): store the user message, run the
 * agent loop, stream its text as written (prose and any OpenUI Lang program
 * together), and store the reply once the model has stopped, split into prose
 * (`content`) and program (`ui_text`). The program is stored unvalidated:
 * parsing it here would load OpenUI into the Worker, and the client parses
 * it anyway, falling back to the prose when it fails.
 *
 * Once the first word is in, the turn runs to its end apart from the
 * response, kept alive by `WaitUntil` when there is one: a client that
 * leaves mid-reply still gets the whole reply stored, so a Draft the model
 * proposed keeps the card that shows it. A model failure after the first
 * word ends the stream with an error and stores what was written before it.
 * An empty reply is a 200 with an empty body, and is stored as such.
 */
export const runChatTurn = (deps: ChatTurnDeps, request: SendChatMessage, receipt?: TurnReceipt) =>
  Effect.gen(function* () {
    const history = yield* deps.history.recent(contextMessages)
    yield* deps.history.append({ role: "user", content: request.message })

    const systemPrompt = yield* SystemPrompt
    const prose = runAgentLoop({
      prompt: buildPrompt(systemPrompt, history, request, receipt),
      toolkit: deps.toolkit,
      stopAfter: draftsShown(),
    }).pipe(
      Stream.filter((part): part is Response.TextDeltaPart => part.type === "text-delta"),
      Stream.map((part) => part.delta),
      Stream.filter((delta) => delta.length > 0),
      Stream.provideService(LanguageModel.LanguageModel, deps.model),
    )

    const { head, rest } = yield* firstChunk(prose).pipe(Effect.mapError(toUnreachable))

    const chunks = yield* Queue.unbounded<string, AgentLoopError<ChatTools> | Cause.Done>()
    let reply = ""
    const emit = (chunk: string) =>
      Effect.suspend(() => {
        reply += chunk
        return Queue.offer(chunks, chunk)
      })
    const afterModel = deps.afterModel ?? (() => Effect.succeed(""))

    const writeReply = Stream.concat(Stream.fromIterable(Option.toArray(head)), rest).pipe(
      Stream.runForEach(emit),
      Effect.tapError((error) => Effect.logError("Chat reply failed mid-stream", error)),
      Effect.onExit((exit) =>
        Effect.gen(function* () {
          const tail = yield* afterModel(reply)
          if (tail.length > 0) yield* emit(tail)
          yield* deps.history.append({ role: "assistant", ...splitReply(reply) })
          yield* Exit.isSuccess(exit) ? Queue.end(chunks) : Queue.failCause(chunks, exit.cause)
        }),
      ),
    )

    // Detached, so a client that leaves interrupts only its own reading, not the turn.
    const fiber = yield* Effect.forkDetach(writeReply)
    const waitUntil = yield* Effect.serviceOption(WaitUntil)
    if (Option.isSome(waitUntil)) {
      waitUntil.value(new Promise((resolve) => fiber.addObserver(resolve)))
    }
    return Stream.fromQueue(chunks)
  })
