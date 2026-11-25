import { Effect, Schema, Stream } from "effect"
import { type Prompt, type Response, Tool, Toolkit } from "effect/ai"
import { describe, expect, it } from "vitest"
import {
  type FakeReply,
  makeFakeLanguageModel,
  scriptedLanguageModel,
  textReply,
  toolCallReply,
} from "../../testing/FakeLanguageModel.ts"
import { type AgentLoopOptions, maxSteps, runAgentLoop } from "./AgentLoop.ts"

// A stand-in tool: the real ones arrive with Drafts (#12).
const Lookup = Tool.make("lookup", {
  parameters: Schema.Struct({ key: Schema.String }),
  success: Schema.String,
})
const Tools = Toolkit.make(Lookup)
const ToolsLive = Tools.toLayer({ lookup: ({ key }) => Effect.succeed(`value of ${key}`) })
type Tools = Toolkit.Tools<typeof Tools>

/** Runs one turn against `model` with the lookup tool and returns the prose it streamed. */
const runTurn = (
  model: { readonly layer: ReturnType<typeof makeFakeLanguageModel>["layer"] },
  options: Omit<AgentLoopOptions<Tools>, "toolkit">,
) =>
  Effect.gen(function* () {
    const toolkit = yield* Tools
    return yield* runAgentLoop({ ...options, toolkit }).pipe(
      Stream.filter((part): part is Response.TextDeltaPart => part.type === "text-delta"),
      Stream.map((part) => part.delta),
      Stream.mkString,
    )
  }).pipe(Effect.provide([model.layer, ToolsLive]), Effect.runPromise)

/** The tool results the model was sent back, as it reads them. */
const toolResultsIn = (prompt: Prompt.Prompt) =>
  prompt.content.flatMap((message) =>
    message.role === "tool"
      ? message.content.flatMap((part) =>
          part.type === "tool-result" ? [{ name: part.name, result: part.result }] : [],
        )
      : [],
  )

describe("the agent loop", () => {
  it("stops after one call when the model answers in prose", async () => {
    const model = scriptedLanguageModel(textReply("Hel", "lo"))

    const text = await runTurn(model, { prompt: "hi" })

    expect(text).toBe("Hello")
    expect(model.calls).toHaveLength(1)
  })

  it("offers the model the toolkit's tools", async () => {
    const model = scriptedLanguageModel(textReply("ok"))

    await runTurn(model, { prompt: "hi" })

    expect(model.calls[0]?.toolNames).toEqual(["lookup"])
  })

  it("calls the model again with the tool result when it answers with a tool call", async () => {
    const model = scriptedLanguageModel(
      toolCallReply("lookup", { key: "budget" }),
      textReply("Your budget is 70rb."),
    )

    const text = await runTurn(model, { prompt: "budget?" })

    expect(text).toBe("Your budget is 70rb.")
    expect(model.calls).toHaveLength(2)
    expect(toolResultsIn(model.calls[1]!.prompt)).toEqual([
      { name: "lookup", result: "value of budget" },
    ])
  })

  it("keeps the conversation so far in every later call", async () => {
    const model = scriptedLanguageModel(
      toolCallReply("lookup", { key: "a" }),
      toolCallReply("lookup", { key: "b" }),
      textReply("done"),
    )

    await runTurn(model, { prompt: "go" })

    const third = model.calls[2]!.prompt
    expect(third.content[0]).toMatchObject({ role: "user" })
    expect(toolResultsIn(third)).toEqual([
      { name: "lookup", result: "value of a" },
      { name: "lookup", result: "value of b" },
    ])
  })

  it("is capped at five model calls when the model never stops calling tools", async () => {
    const model = makeFakeLanguageModel((): FakeReply => toolCallReply("lookup", { key: "again" }))

    const text = await runTurn(model, { prompt: "loop forever" })

    expect(maxSteps).toBe(5)
    expect(model.calls).toHaveLength(5)
    expect(text).toBe("")
  })

  it("streams prose from every step, not only the last", async () => {
    const model = scriptedLanguageModel(
      [
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "Checking. " },
        { type: "text-end", id: "t" },
        { type: "tool-call", id: "c", name: "lookup", params: { key: "x" } },
        { type: "finish", reason: "tool-calls", usage: { inputTokens: {}, outputTokens: {} } },
      ],
      textReply("Found it."),
    )

    const text = await runTurn(model, { prompt: "find x" })

    expect(text).toBe("Checking. Found it.")
  })

  it("stops early once stopAfter says the turn is done", async () => {
    const model = makeFakeLanguageModel(() => toolCallReply("lookup", { key: "draft" }))

    await runTurn(model, {
      prompt: "buy cloth 70rb",
      stopAfter: (step) => step.parts.some((part) => part.type === "tool-result"),
    })

    expect(model.calls).toHaveLength(1)
  })

  it("does not ask stopAfter about a step that ran no tools", async () => {
    const model = scriptedLanguageModel(textReply("hi"))
    const asked: Array<number> = []

    await runTurn(model, {
      prompt: "hi",
      stopAfter: (step) => {
        asked.push(step.index)
        return false
      },
    })

    expect(asked).toEqual([])
  })
})
