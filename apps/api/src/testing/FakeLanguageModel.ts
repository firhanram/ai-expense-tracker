import { Effect, Layer, Stream } from "effect"
import { AiError, LanguageModel, type Prompt, type Response } from "effect/ai"

/** One scripted model response: the parts it streams, the error it fails with, or a stream of both. */
export type FakeReply =
  | ReadonlyArray<Response.StreamPartEncoded>
  | AiError.AiError
  | Stream.Stream<Response.StreamPartEncoded, AiError.AiError>

/** What the fake was asked, one entry per model call. */
export interface FakeCall {
  readonly prompt: Prompt.Prompt
  readonly toolNames: ReadonlyArray<string>
}

const usage = { inputTokens: {}, outputTokens: {} }

/** A reply that streams `chunks` as prose and stops. No chunks is an empty reply. */
export const textReply = (...chunks: ReadonlyArray<string>): FakeReply => [
  ...(chunks.length === 0
    ? []
    : [
        { type: "text-start", id: "t" } as const,
        ...chunks.map((delta) => ({ type: "text-delta", id: "t", delta }) as const),
        { type: "text-end", id: "t" } as const,
      ]),
  { type: "finish", reason: "stop", usage },
]

let callId = 0

/** A reply that asks for one tool call and no prose. */
export const toolCallReply = (name: string, params: unknown): FakeReply => [
  { type: "tool-call", id: `call-${++callId}`, name, params, providerExecuted: false },
  { type: "finish", reason: "tool-calls", usage },
]

/** The model failing the way an unreachable provider does: a transport error. */
export const unreachable = (): AiError.AiError =>
  new AiError.AiError({
    module: "FakeLanguageModel",
    method: "streamText",
    reason: new AiError.NetworkError({
      reason: "TransportError",
      method: "POST",
      url: "https://model.invalid/chat/completions",
    }),
  })

/**
 * S2 seam: a `LanguageModel` the test scripts. `respond` gets the zero-based
 * call index, so a test can answer every call the same way (to drive a loop
 * into its cap) or follow a fixed script. No network, no key.
 */
export const makeFakeLanguageModel = (respond: (call: number) => FakeReply) => {
  const calls: Array<FakeCall> = []

  const layer = Layer.effect(
    LanguageModel.LanguageModel,
    LanguageModel.make({
      generateText: () => Effect.die("the fake model only streams"),
      streamText: (options) =>
        Stream.suspend(() => {
          const reply = respond(calls.length)
          calls.push({ prompt: options.prompt, toolNames: options.tools.map((tool) => tool.name) })
          if (reply instanceof AiError.AiError) return Stream.fail(reply)
          return Stream.isStream(reply) ? reply : Stream.fromIterable(reply)
        }),
    }),
  )

  return { layer, calls }
}

/** A reply that starts writing `text`, then loses the connection. */
export const failsMidway = (text: string): FakeReply =>
  Stream.concat(
    Stream.fromIterable<Response.StreamPartEncoded>([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: text },
    ]),
    Stream.fail(unreachable()),
  )

/** `makeFakeLanguageModel` answering call `n` with `replies[n]`, failing loudly past the end. */
export const scriptedLanguageModel = (...replies: ReadonlyArray<FakeReply>) =>
  makeFakeLanguageModel((call) => {
    const reply = replies[call]
    if (reply === undefined) {
      throw new Error(`model called ${call + 1} times; the script has ${replies.length}`)
    }
    return reply
  })
