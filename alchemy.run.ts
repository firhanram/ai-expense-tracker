import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

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
      // API_TOKEN comes from the environment or `.env` (see `.env.example`),
      // and is bound as a secret, never a plain var.
      env: { DB: db, API_TOKEN: Config.Redacted("API_TOKEN") },
    })

    return { url: worker.url }
  }),
)
