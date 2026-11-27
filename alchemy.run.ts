import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Command from "alchemy/Command"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"

/**
 * One Worker: the Effect HTTP app under `/api/*`, with D1 bound as `DB`
 * and the Receipts bucket bound as `RECEIPTS` (ADR-0010), the Cloudflare Access
 * team and application it verifies tokens against as `ACCESS_TEAM_DOMAIN` and
 * `ACCESS_AUD` (ADR-0011), and the model key as `API_PROVIDER_KEY`. The SPA (`apps/web`) is the
 * same Worker's static assets: one origin, `/api/*` to the Worker, every other
 * unmatched path to `index.html` for client-side routing.
 *
 * On deploy, the one-time PIN login and the Access application in front of the
 * Worker are declared here too, so the Worker's AUD tag comes from the
 * application and its team domain from this file, not from `.env`.
 */
export default Alchemy.Stack(
  "ExpenseTracker",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const { dev } = yield* Alchemy.AlchemyContext

    // Applied on deploy and in `alchemy dev`; tests apply the same directory.
    const db = yield* Cloudflare.D1.Database("DB", { migrations: "./apps/api/migrations" })

    // Receipt images. Private: served only through the API, behind Access.
    const receipts = yield* Cloudflare.R2.Bucket("Receipts")

    // The SPA bundle. It carries no credential: Access signs the owner in and its
    // cookie rides along with every same-origin request (ADR-0011).
    const web = yield* Command.Build("Web", {
      command: "pnpm build",
      cwd: "./apps/web",
      outdir: "dist",
    })

    // Cloudflare Access (ADR-0011, README "Cloudflare Access"). Deploy only:
    // `alchemy dev` serves on localhost, which the Worker exempts, and must not
    // touch the account's Zero Trust settings.
    const access = dev ? undefined : yield* accessResources

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
      // No custom domain yet: the app lives on its `workers.dev` URL. Access
      // covers that URL and the version preview URLs through the application's
      // `worker` and `preview_worker` destinations, which `access` adds.
      ...(access ? { access: access.application } : {}),
      env: {
        DB: db,
        RECEIPTS: receipts,
        // Not secrets: the AUD tag and team domain identify, they do not authorise.
        // Unset under `alchemy dev`, where only loopback requests reach the
        // Worker and those skip the check.
        ...(access
          ? { ACCESS_TEAM_DOMAIN: access.teamDomain, ACCESS_AUD: access.application.aud }
          : {}),
        // The model provider's key, from Infisical: `pnpm dev` and `pnpm run deploy`
        // run under `infisical run`, which puts it in the environment. Bound as
        // a secret, never a plain var.
        API_PROVIDER_KEY: Config.Redacted("API_PROVIDER_KEY"),
        // Which provider the key belongs to (apps/api/src/features/chat/ModelProvider.ts).
        MODEL_PROVIDER: "deepseek",
      },
    })

    // `alchemy dev` only: the Vite dev server with hot reload, proxying `/api/*`
    // to the local Worker (apps/web/vite.config.ts). The Worker above still
    // serves the built bundle; open this URL while editing the SPA.
    if (dev) {
      const webDev = yield* Command.Dev("WebDev", {
        command: "pnpm exec vite",
        cwd: "./apps/web",
        port: 5173,
        env: { API_ORIGIN: worker.url },
      })
      return { url: worker.url, webDevUrl: webDev.url }
    }

    return { url: worker.url }
  }),
)

/**
 * One-time PIN login and one self-hosted Access application that only the
 * owner can pass.
 *
 * The Zero Trust organization (team `hanlabs`) is managed in the dashboard,
 * not here: an account has exactly one, and declaring it would reset every
 * setting this file doesn't name. Renaming the team means changing
 * `teamDomain` below and deploying again.
 *
 * The owner's email comes from `ACCESS_OWNER_EMAIL` (`.env`), not this file:
 * the repository is public.
 */
const accessResources = Effect.gen(function* () {
  const ownerEmail = yield* Config.String("ACCESS_OWNER_EMAIL")

  const teamDomain = "hanlabs.cloudflareaccess.com"

  // Access emails a code to the address that signs in.
  const pin = yield* Cloudflare.Access.IdentityProvider("Pin", {
    type: "onetimepin",
    name: "One-time PIN",
  })

  const application = yield* Cloudflare.Access.Application("App", {
    type: "self_hosted",
    name: "Expense tracker",
    sessionDuration: "720h",
    allowedIdps: [pin.identityProviderId],
    autoRedirectToIdentity: true,
    appLauncherVisible: false,
    // Other sites can't make the browser send the Access cookie with a POST or
    // an embedded request, and page scripts can't read it. The Worker's
    // same-origin check is the first layer. Not "strict": the sign-in ends in a
    // redirect chain that starts on cloudflareaccess.com, a Strict cookie is
    // withheld from it, and Access loops back to the login.
    sameSiteCookieAttribute: "lax",
    httpOnlyCookieAttribute: true,
    policies: [{ name: "Owner", decision: "allow", include: [{ email: ownerEmail }] }],
  })

  return { application, teamDomain }
})
