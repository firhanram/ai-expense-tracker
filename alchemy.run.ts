import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Command from "alchemy/Command"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

/**
 * One Worker: the Effect HTTP app under `/api/*`, with D1 bound as `DB`
 * and the Receipts bucket bound as `RECEIPTS` (ADR-0010), and the bearer token
 * as `API_TOKEN`, and the model key as `API_PROVIDER_KEY`. The SPA (`apps/web`) is the
 * same Worker's static assets: one origin, `/api/*` to the Worker, every other
 * unmatched path to `index.html` for client-side routing.
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

    // Receipt images. Private: served only through the API behind the token.
    const receipts = yield* Cloudflare.R2.Bucket("Receipts")

    // The SPA bundle. It carries no token: anything baked into a public bundle is
    // public, so the bearer token stays server-side. Local `alchemy dev` needs none
    // (loopback is exempt); production auth for the SPA is an open item on #5.
    const web = yield* Command.Build("Web", {
      command: "pnpm build",
      cwd: "./apps/web",
      outdir: "dist",
    })

    const worker = yield* Cloudflare.Worker("Api", {
      main: "./apps/api/src/index.ts",
      compatibility: { date: "2026-11-02", flags: ["nodejs_compat"] },
      // Daily at 03:00 UTC: the orphan Receipt sweep (apps/api/src/features/receipts/OrphanSweep.ts).
      crons: ["0 3 * * *"],
      assets: {
        directory: web.outdir,
        runWorkerFirst: ["/api/*"],
        notFoundHandling: "single-page-application",
      },
      env: {
        DB: db,
        RECEIPTS: receipts,
        // API_TOKEN comes from the environment or `.env` (see `.env.example`),
        // and is bound as a secret, never a plain var.
        API_TOKEN: Config.Redacted("API_TOKEN"),
        // The model provider's key, from Infisical: `pnpm dev` and `pnpm deploy`
        // run under `infisical run`, which puts it in the environment. Bound as
        // a secret, never a plain var.
        API_PROVIDER_KEY: Config.Redacted("API_PROVIDER_KEY"),
        // Which provider the key belongs to (apps/api/src/features/chat/ModelProvider.ts).
        MODEL_PROVIDER: "deepseek",
      },
    })

    return { url: worker.url }
  }),
)
