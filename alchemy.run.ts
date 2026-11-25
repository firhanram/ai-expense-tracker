import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

/**
 * The account's Secrets Store (`default_secrets_store`). The model provider's
 * key lives there, set out-of-band with `wrangler secrets-store secret create`.
 */
const secretsStoreId = "4eca2d2621644f8396b03e7ca3478f49"

/**
 * One Worker: the Effect HTTP app under `/api/*`, with D1 bound as `DB`
 * (ADR-0010) and the bearer token as `API_TOKEN`. The SPA's static assets and R2 join it in later slices.
 */
export default Alchemy.Stack(
  "ExpenseTracker",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    // Applied on deploy and in `alchemy dev`; tests apply the same directory.
    const db = yield* Cloudflare.D1.Database("DB", { migrations: "./apps/api/migrations" })

    const worker = yield* Cloudflare.Worker("Api", {
      main: "./apps/api/src/index.ts",
      compatibility: { date: "2026-11-20", flags: ["nodejs_compat"] },
      env: {
        DB: db,
        // API_TOKEN comes from the environment or `.env` (see `.env.example`),
        // and is bound as a secret, never a plain var.
        API_TOKEN: Config.Redacted("API_TOKEN"),
        // Looked up, never managed: Alchemy binds the existing Secrets Store
        // secret and never creates, updates or deletes it or its value.
        API_PROVIDER_KEY: Cloudflare.SecretsStore.Secret.lookup({
          storeId: secretsStoreId,
          name: "API_PROVIDER_KEY",
        }),
        // Which provider the key belongs to (apps/api/src/features/chat/ModelProvider.ts).
        MODEL_PROVIDER: "deepseek",
      },
    })

    return { url: worker.url }
  }),
)
