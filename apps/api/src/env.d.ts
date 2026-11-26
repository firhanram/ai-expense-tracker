// Worker bindings. Alchemy declares the real resources; this is their type.
declare namespace Cloudflare {
  interface Env {
    readonly DB: D1Database
    /** Receipt images (PLAN, "Receipts"). Served only through the API, never presigned. */
    readonly RECEIPTS: R2Bucket
    /**
     * The Cloudflare Access team domain, e.g. `myteam.cloudflareaccess.com`
     * (ADR-0011). Its keys sign the `Cf-Access-Jwt-Assertion` every API route
     * but health requires. Unset: every protected route is refused.
     */
    readonly ACCESS_TEAM_DOMAIN?: string | undefined
    /** The Access application's AUD tag. Unset: every protected route is refused. */
    readonly ACCESS_AUD?: string | undefined
    /** The model provider's API key (DeepSeek by default). A secret from Infisical, never in source. */
    readonly API_PROVIDER_KEY?: string
    /** Which provider `ModelProvider.ts` builds; `deepseek` when unset. */
    readonly MODEL_PROVIDER?: string
    /** Overrides the provider's default model name. */
    readonly MODEL_NAME?: string
  }
}
