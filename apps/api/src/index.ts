import { env } from "cloudflare:workers"
import { Context } from "effect"
import { makeHandler, runScheduled } from "./App.ts"
import { WaitUntil } from "./WaitUntil.ts"

// Built once at module scope, not per request.
const app = makeHandler(env)

export default {
  // Per request, the one service a handler cannot get from the layer: this request's `waitUntil`.
  fetch: (request: Request, _env: Cloudflare.Env, ctx: ExecutionContext) =>
    app.handler(
      request,
      Context.make(WaitUntil, (promise) => ctx.waitUntil(promise)),
    ),
  scheduled: (controller, _env, ctx) => ctx.waitUntil(runScheduled(env, controller.scheduledTime)),
} satisfies ExportedHandler<Cloudflare.Env>
