// Worker bindings. Alchemy declares the real resources; this is their type.
declare namespace Cloudflare {
  interface Env {
    readonly DB: D1Database
    /** Receipt images (PLAN, "Receipts"). Served only through the API, never presigned. */
    readonly RECEIPTS: R2Bucket
    /** Bearer token every API route but health requires. A secret, never in source. */
    readonly API_TOKEN: string
    /** The model provider's API key (DeepSeek by default). A secret from Infisical, never in source. */
    readonly API_PROVIDER_KEY?: string
    /** Which provider `ModelProvider.ts` builds; `deepseek` when unset. */
    readonly MODEL_PROVIDER?: string
    /** Overrides the provider's default model name. */
    readonly MODEL_NAME?: string
  }
}
