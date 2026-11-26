import { env } from "cloudflare:workers"
import { Context } from "effect"
import { makeHandler, runScheduled } from "./App.ts"

// Built once at module scope, not per request.
const app = makeHandler(env)
const context = Context.empty()

export default {
  fetch: (request: Request) => app.handler(request, context),
  scheduled: (controller, _env, ctx) => ctx.waitUntil(runScheduled(env, controller.scheduledTime)),
} satisfies ExportedHandler<Cloudflare.Env>
