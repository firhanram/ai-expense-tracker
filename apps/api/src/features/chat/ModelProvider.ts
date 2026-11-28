import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { Effect, Layer, Redacted } from "effect"
import { LanguageModel } from "effect/ai"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"

/**
 * Every provider here speaks the OpenAI chat-completions API, so one client
 * with a base-URL override reaches each (PLAN, Dependencies). DeepSeek is the
 * choice (ADR-0008); Gemini is the fallback PLAN names if the slice-6 eval fails.
 */
export const modelProviders = {
  deepseek: {
    apiUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    adaptRequest: (body: JsonObject) => deepSeekRequest(body),
  },
  gemini: {
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.1-flash-lite",
  },
} as const

export type ModelProviderName = keyof typeof modelProviders

export const defaultModelProvider: ModelProviderName = "deepseek"

export interface ModelProviderConfig {
  /** Which entry of `modelProviders`. Defaults to `deepseek`. */
  readonly provider?: string | undefined
  /** Overrides the provider's default model name. */
  readonly model?: string | undefined
  /**
   * The provider's API key. Checked on every model request rather than at
   * startup, so the app starts (and health answers) without it.
   */
  readonly apiKey: string | undefined
}

type JsonObject = { readonly [key: string]: unknown }

interface ProviderEntry {
  readonly apiUrl: string
  readonly model: string
  /** Rewrites a chat-completions request body for a provider's quirks. */
  readonly adaptRequest?: (body: JsonObject) => JsonObject
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const forcesTool = (body: JsonObject) =>
  body.tool_choice !== undefined && body.tool_choice !== "auto" && body.tool_choice !== "none"

/**
 * DeepSeek's thinking mode refuses a `tool_choice` that forces a tool, so a
 * call that forces one (a Receipt turn's first, `propose_expense`) runs with
 * thinking off. And in thinking mode every assistant tool call in the history
 * must carry its `reasoning_content`; one made with thinking off has none, and
 * the client leaves the field out when it is empty, so it is sent as "".
 */
const deepSeekRequest = (body: JsonObject): JsonObject => {
  const messages = Array.isArray(body.messages)
    ? body.messages.map((message: unknown) =>
        isObject(message) &&
        message.role === "assistant" &&
        message.tool_calls !== undefined &&
        message.reasoning_content === undefined
          ? { ...message, reasoning_content: "" }
          : message,
      )
    : body.messages
  return {
    ...body,
    messages,
    ...(forcesTool(body) ? { thinking: { type: "disabled" } } : {}),
  }
}

/** Applies `adapt` to a request whose body is JSON; leaves any other request alone. */
const adaptJsonBody =
  (adapt: (body: JsonObject) => JsonObject) =>
  (request: HttpClientRequest.HttpClientRequest): HttpClientRequest.HttpClientRequest => {
    const { body } = request
    // oxlint-disable-next-line no-underscore-dangle -- `_tag` is how Effect names a body's kind.
    if (body._tag !== "Uint8Array" || !body.contentType.includes("json")) return request
    const json: unknown = JSON.parse(new TextDecoder().decode(body.body))
    return isObject(json) ? HttpClientRequest.bodyJsonUnsafe(request, adapt(json)) : request
  }

const isProviderName = (name: string): name is ModelProviderName =>
  Object.hasOwn(modelProviders, name)

/** A missing key is a deployment mistake, not an unreachable model: it is a defect (500). */
const readKey = (key: string | undefined) =>
  key ? Effect.succeed(Redacted.make(key)) : Effect.die(new Error("API_PROVIDER_KEY is not set"))

/**
 * The `LanguageModel` the Chat talks to, chosen by configuration. Swapping
 * provider is this `Layer`, not a code change (ADR-0008). An unknown provider
 * name is a deployment mistake and fails the app at startup.
 */
export const ModelProviderLive = (
  config: ModelProviderConfig,
): Layer.Layer<LanguageModel.LanguageModel> => {
  const name = config.provider || defaultModelProvider
  if (!isProviderName(name)) {
    const known = Object.keys(modelProviders).join(", ")
    return Layer.effect(
      LanguageModel.LanguageModel,
      Effect.die(new Error(`Unknown MODEL_PROVIDER "${name}"; expected one of ${known}`)),
    )
  }
  const provider: ProviderEntry = modelProviders[name]
  const { adaptRequest } = provider
  return OpenAiLanguageModel.layer({ model: config.model || provider.model }).pipe(
    Layer.provide(
      OpenAiClient.layer({
        apiUrl: provider.apiUrl,
        transformClient: (client) =>
          client.pipe(
            HttpClient.mapRequest(
              adaptRequest === undefined ? (request) => request : adaptJsonBody(adaptRequest),
            ),
            HttpClient.mapRequestEffect((request) =>
              readKey(config.apiKey).pipe(
                Effect.map((key) => HttpClientRequest.bearerToken(request, Redacted.value(key))),
              ),
            ),
          ),
      }),
    ),
    Layer.provide(FetchHttpClient.layer),
  )
}
