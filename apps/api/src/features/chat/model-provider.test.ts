import { Cause, Effect, Exit, Schema, Stream } from "effect"
import { LanguageModel, type Prompt, Tool, Toolkit } from "effect/ai"
import { FetchHttpClient } from "effect/http"
import { describe, expect, it } from "vitest"
import { ModelProviderLive } from "./ModelProvider.ts"

interface Sent {
  readonly url: string
  readonly authorization: string | null
  readonly model: unknown
  readonly body: Record<string, unknown>
}

const chunk = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`

const offline: typeof fetch = () => Promise.reject(new TypeError("fetch failed"))

/** A `fetch` that answers like an OpenAI-compatible endpoint streaming "ok", and records the request. */
const fakeFetch =
  (sent: Array<Sent>): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init)
    const body = await request.json<Record<string, unknown>>()
    sent.push({
      url: request.url,
      authorization: request.headers.get("authorization"),
      model: body.model,
      body,
    })
    return new Response(
      chunk({
        id: "1",
        object: "chat.completion.chunk",
        created: 0,
        model: "m",
        choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
      }) +
        chunk({
          id: "1",
          object: "chat.completion.chunk",
          created: 0,
          model: "m",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        }) +
        "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    )
  }

const streamOk = (layer: ReturnType<typeof ModelProviderLive>, fetchImpl: typeof fetch) =>
  LanguageModel.streamText({ prompt: "hi" }).pipe(
    Stream.filter((part) => part.type === "text-delta"),
    Stream.map((part) => part.delta),
    Stream.mkString,
    Effect.provide(layer),
    Effect.provideService(FetchHttpClient.Fetch, fetchImpl),
    Effect.runPromiseExit,
  )

const Lookup = Tool.make("lookup", { parameters: Schema.Struct({ key: Schema.String }) })
const Tools = Toolkit.make(Lookup)
const ToolsLive = Tools.toLayer({ lookup: () => Effect.void })

/** Streams one call offering the lookup tool with `toolChoice`, and returns the body sent. */
const sendWithTool = async (
  layer: ReturnType<typeof ModelProviderLive>,
  toolChoice: LanguageModel.ToolChoice<"lookup">,
  prompt: Prompt.RawInput = "hi",
) => {
  const sent: Array<Sent> = []
  await Effect.gen(function* () {
    const toolkit = yield* Tools
    yield* LanguageModel.streamText({ prompt, toolkit, toolChoice }).pipe(Stream.runDrain)
  }).pipe(
    Effect.provide([layer, ToolsLive]),
    Effect.provideService(FetchHttpClient.Fetch, fakeFetch(sent)),
    Effect.runPromiseExit,
  )
  return sent[0]?.body
}

describe("the model provider layer", () => {
  it("defaults to DeepSeek's API with the configured key", async () => {
    const sent: Array<Sent> = []

    const exit = await streamOk(ModelProviderLive({ apiKey: "sk-test" }), fakeFetch(sent))

    expect(exit).toEqual(Exit.succeed("ok"))
    expect(sent.map(({ url, authorization, model }) => ({ url, authorization, model }))).toEqual([
      {
        url: "https://api.deepseek.com/chat/completions",
        authorization: "Bearer sk-test",
        model: "deepseek-flash",
      },
    ])
  })

  it("is chosen by configuration", async () => {
    const sent: Array<Sent> = []

    await streamOk(
      ModelProviderLive({ provider: "gemini", model: "gemini-x", apiKey: "g-key" }),
      fakeFetch(sent),
    )

    expect(sent[0]).toMatchObject({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-x",
    })
  })

  it("turns DeepSeek's thinking off on a call that forces a tool, which thinking mode refuses", async () => {
    const layer = ModelProviderLive({ apiKey: "sk-test" })

    const forced = await sendWithTool(layer, { tool: "lookup" })
    const auto = await sendWithTool(layer, "auto")

    expect(forced).toMatchObject({ thinking: { type: "disabled" } })
    expect(forced?.tool_choice).toBeDefined()
    expect(auto).not.toHaveProperty("thinking")
  })

  it("sends DeepSeek an empty reasoning_content for a tool call made with thinking off", async () => {
    // The forced call's tool call carries no reasoning, and thinking mode
    // refuses a history whose tool calls lack it.
    const sent = await sendWithTool(ModelProviderLive({ apiKey: "sk-test" }), "auto", [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [{ type: "tool-call", id: "call-1", name: "lookup", params: { key: "k" } }],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", id: "call-1", name: "lookup", isFailure: false, result: null },
        ],
      },
    ])

    expect(sent?.messages).toContainEqual(
      expect.objectContaining({ role: "assistant", reasoning_content: "" }),
    )
    expect(sent).not.toHaveProperty("thinking")
  })

  it("leaves Gemini's forced-tool calls as they are", async () => {
    const forced = await sendWithTool(ModelProviderLive({ provider: "gemini", apiKey: "g-key" }), {
      tool: "lookup",
    })

    expect(forced).not.toHaveProperty("thinking")
  })

  it("fails with a NetworkError when the provider cannot be reached", async () => {
    const exit = await streamOk(ModelProviderLive({ apiKey: "sk-test" }), offline)

    expect(Exit.isFailure(exit)).toBe(true)
    expect(JSON.stringify(exit)).toContain("NetworkError")
  })

  it("fails the request, without calling the provider, when the key is not set", async () => {
    const sent: Array<Sent> = []
    const exit = await streamOk(ModelProviderLive({ apiKey: undefined }), fakeFetch(sent))

    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain(
      "API_PROVIDER_KEY is not set",
    )
    expect(sent).toHaveLength(0)
  })

  it("refuses an unknown provider name", async () => {
    const exit = await streamOk(ModelProviderLive({ provider: "nope", apiKey: "k" }), fakeFetch([]))

    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain(
      'Unknown MODEL_PROVIDER "nope"',
    )
  })
})
