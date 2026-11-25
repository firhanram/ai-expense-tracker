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
  deepseek: { apiUrl: "https://api.deepseek.com", model: "deepseek-flash" },
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
   * The provider's API key, as a Secrets Store binding. Read on every model
   * request, so the app starts (and health answers) without it, and a
   * rotated key is picked up without a deploy.
   */
  readonly apiKey: SecretsStoreSecret
}

const isProviderName = (name: string): name is ModelProviderName =>
  Object.hasOwn(modelProviders, name)

/** A missing key is a deployment mistake, not an unreachable model: it is a defect (500). */
const readKey = (secret: SecretsStoreSecret) =>
  Effect.tryPromise({
    try: () => secret.get(),
    catch: (cause) =>
      new Error("API_PROVIDER_KEY could not be read from the Secrets Store", { cause }),
  }).pipe(Effect.map(Redacted.make), Effect.orDie)

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
  const provider = modelProviders[name]
  return OpenAiLanguageModel.layer({ model: config.model || provider.model }).pipe(
    Layer.provide(
      OpenAiClient.layer({
        apiUrl: provider.apiUrl,
        transformClient: HttpClient.mapRequestEffect((request) =>
          readKey(config.apiKey).pipe(
            Effect.map((key) => HttpClientRequest.bearerToken(request, Redacted.value(key))),
          ),
        ),
      }),
    ),
    Layer.provide(FetchHttpClient.layer),
  )
}
