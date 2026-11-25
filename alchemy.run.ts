import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Effect from "effect/Effect"

/**
 * One Worker: the Effect HTTP app under `/api/*`, with D1 bound as `DB`
 * (ADR-0010). The SPA's static assets and R2 join it in later slices.
 */
export default Alchemy.Stack(
  "ExpenseTracker",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.Database("DB")

    const worker = yield* Cloudflare.Worker("Api", {
      main: "./apps/api/src/index.ts",
      compatibility: { date: "2026-11-20", flags: ["nodejs_compat"] },
      env: { DB: db },
    })

    return { url: worker.url }
  }),
)
