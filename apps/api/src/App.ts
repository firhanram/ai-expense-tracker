import { D1Client } from "@effect/sql-d1"
import { Api } from "@expense/contract"
import { Layer, Scheduler } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { BearerAuth } from "./features/auth/BearerAuth.ts"
import { ExpensesLive } from "./features/expenses/ExpensesLive.ts"
import { HealthLive } from "./features/health/HealthLive.ts"

/**
 * Workers run each request's fibers in that request's async context, so the
 * runtime uses a synchronous scheduler (see `HttpRouter.toWebHandler`).
 */
const SyncScheduler = Layer.succeed(Scheduler.Scheduler, new Scheduler.MixedScheduler("sync"))

export const makeApp = (env: Cloudflare.Env) =>
  Layer.mergeAll(HttpApiBuilder.layer(Api), BearerAuth(env.API_TOKEN)).pipe(
    Layer.provide([HealthLive, ExpensesLive]),
    // Request validation 400s name the offending field; 500s still carry no detail.
    Layer.provide(HttpApiMiddleware.layerProblemDetails({ includeDetails: true })),
    Layer.provide(D1Client.layer({ db: env.DB })),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(SyncScheduler),
  )

export const makeHandler = (env: Cloudflare.Env) => HttpRouter.toWebHandler(makeApp(env))
