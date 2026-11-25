import { env } from "cloudflare:workers"
import { Context } from "effect"
import { makeHandler } from "./App.ts"

// Built once at module scope, not per request.
const app = makeHandler(env)
const context = Context.empty()

export default {
  fetch: (request: Request) => app.handler(request, context),
} satisfies ExportedHandler<Cloudflare.Env>
