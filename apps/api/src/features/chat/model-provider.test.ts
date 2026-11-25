import { Cause, Effect, Exit, Stream } from "effect"
import { LanguageModel } from "effect/ai"
import { FetchHttpClient } from "effect/http"
import { describe, expect, it } from "vitest"
import { ModelProviderLive } from "./ModelProvider.ts"

const secret = (value: string): SecretsStoreSecret => ({ get: () => Promise.resolve(value) })

interface Sent {
  readonly url: string
  readonly authorization: string | null
  readonly model: unknown
}

const chunk = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`

const offline: typeof fetch = () => Promise.reject(new TypeError("fetch failed"))

/** A `fetch` that answers like an OpenAI-compatible endpoint streaming "ok", and records the request. */
const fakeFetch =
  (sent: Array<Sent>): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init)
    const body = await request.json<{ model: unknown }>()
    sent.push({
      url: request.url,
      authorization: request.headers.get("authorization"),
      model: body.model,
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

describe("the model provider layer", () => {
  it("defaults to DeepSeek's API with the key read from the Secrets Store", async () => {
    const sent: Array<Sent> = []

    const exit = await streamOk(ModelProviderLive({ apiKey: secret("sk-test") }), fakeFetch(sent))

    expect(exit).toEqual(Exit.succeed("ok"))
    expect(sent).toEqual([
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
      ModelProviderLive({ provider: "gemini", model: "gemini-x", apiKey: secret("g-key") }),
      fakeFetch(sent),
    )

    expect(sent[0]).toMatchObject({
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: "gemini-x",
    })
  })

  it("fails with a NetworkError when the provider cannot be reached", async () => {
    const exit = await streamOk(ModelProviderLive({ apiKey: secret("sk-test") }), offline)

    expect(Exit.isFailure(exit)).toBe(true)
    expect(JSON.stringify(exit)).toContain("NetworkError")
  })

  it("refuses an unknown provider name", async () => {
    const exit = await streamOk(
      ModelProviderLive({ provider: "nope", apiKey: secret("k") }),
      fakeFetch([]),
    )

    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain(
      'Unknown MODEL_PROVIDER "nope"',
    )
  })
})
