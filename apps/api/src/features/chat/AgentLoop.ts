import { Effect, Stream } from "effect"
import {
  type AiError,
  LanguageModel,
  Prompt,
  type Response,
  type Tool,
  type Toolkit,
} from "effect/ai"

/** Model calls one Chat turn may make (PLAN, "The chat turn"). */
const maxSteps = 5

/** One model call and everything it streamed, including resolved tool results. */
export interface AgentStep<Tools extends Record<string, Tool.Any>> {
  /** Zero-based: the first call is step 0. */
  readonly index: number
  readonly parts: ReadonlyArray<Response.StreamPart<Tools, "opaque">>
}

export interface AgentLoopOptions<Tools extends Record<string, Tool.Any>> {
  readonly prompt: Prompt.RawInput
  /** Tools the model may call. `LanguageModel` runs their handlers; the loop feeds the results back. */
  readonly toolkit?: Toolkit.WithHandler<Tools> | undefined
  /**
   * Ends the turn after a step even though it ran tools, e.g. once a Draft
   * Expense has been proposed (#12). Asked only when the loop would go on.
   */
  readonly stopAfter?: ((step: AgentStep<Tools>) => boolean) | undefined
  /**
   * How the model must use its tools on the first call; later calls are
   * `"auto"`. A Receipt turn sets it so the model cannot skip proposing.
   */
  readonly firstToolChoice?: LanguageModel.ToolChoice<ToolOf<Tools>["name"]> | undefined
  /**
   * Asked after every step: a note telling the model what it got wrong, or
   * undefined. A note sends the model back, with the note after its reply,
   * even if the step ran no tools or `stopAfter` would end the turn.
   */
  readonly correct?: ((step: AgentStep<Tools>) => string | undefined) | undefined
}

/** Any one of the toolkit's tools, the shape `Tool`'s type helpers take. */
type ToolOf<Tools extends Record<string, Tool.Any>> = Tools[keyof Tools]

export type AgentLoopError<Tools extends Record<string, Tool.Any>> =
  | AiError.AiError
  | Tool.HandlerError<ToolOf<Tools>>

export type AgentLoopServices<Tools extends Record<string, Tool.Any>> =
  | LanguageModel.LanguageModel
  | Tool.HandlerServices<ToolOf<Tools>>
  | Tool.ResultDecodingServices<ToolOf<Tools>>
  | Tool.ParametersEncodingServices<ToolOf<Tools>>

type AgentStream<Tools extends Record<string, Tool.Any>> = Stream.Stream<
  Response.StreamPart<Tools, "opaque">,
  AgentLoopError<Tools>,
  AgentLoopServices<Tools>
>

/** A step that ran one of our tools needs another call so the model can read the result. */
const ranTools = (parts: ReadonlyArray<Response.AnyPart>) =>
  parts.some((part) => part.type === "tool-result" && !part.providerExecuted && !part.preliminary)

/**
 * The tool-call loop. `LanguageModel.streamText` resolves tool calls and
 * returns; it does not call the model again. This does: while a step ran
 * tools, or `correct` objected to it, it appends that step's calls and
 * results (and the correction) to the prompt and calls again, until the
 * model answers without tools, `stopAfter` says so, or `maxSteps` calls
 * have been made.
 *
 * Every step's parts stream through as they arrive, so prose reaches the
 * caller while the model is still writing it.
 */
export const runAgentLoop = <Tools extends Record<string, Tool.Any> = {}>(
  options: AgentLoopOptions<Tools>,
): AgentStream<Tools> => {
  const step = (index: number, prompt: Prompt.Prompt): AgentStream<Tools> => {
    const parts: Array<Response.StreamPart<Tools, "opaque">> = []
    const toolChoice = (index === 0 ? options.firstToolChoice : undefined) ?? "auto"
    const call = (
      options.toolkit === undefined
        ? LanguageModel.streamText({ prompt })
        : LanguageModel.streamText({ prompt, toolkit: options.toolkit, toolChoice })
    ) satisfies AgentStream<Tools>
    return Stream.concat(
      call.pipe(Stream.tap((part) => Effect.sync(() => parts.push(part)))),
      Stream.suspend((): AgentStream<Tools> => {
        const correction = options.correct?.({ index, parts })
        if (correction === undefined) {
          if (!ranTools(parts) || options.stopAfter?.({ index, parts })) return Stream.empty
        }
        if (index + 1 >= maxSteps) {
          return Stream.drain(
            Stream.fromEffect(Effect.logWarning(`Chat turn hit the ${maxSteps}-step cap`)),
          )
        }
        const next = Prompt.concat(prompt, Prompt.fromResponseParts(parts))
        return step(
          index + 1,
          correction === undefined
            ? next
            : Prompt.concat(next, Prompt.make([{ role: "system", content: correction }])),
        )
      }),
    )
  }

  return Stream.suspend(() => step(0, Prompt.make(options.prompt)))
}
