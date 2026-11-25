import { D1Client } from "@effect/sql-d1"
import { Api } from "@expense/contract"
import { Layer, Scheduler } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { HealthLive } from "./features/health/HealthLive.ts"

/**
 * Workers run each request's fibers in that request's async context, so the
 * runtime uses a synchronous scheduler (see `HttpRouter.toWebHandler`).
 */
const SyncScheduler = Layer.succeed(Scheduler.Scheduler, new Scheduler.MixedScheduler("sync"))

export const makeApp = (env: Cloudflare.Env) =>
  HttpApiBuilder.layer(Api).pipe(
    Layer.provide(HealthLive),
    Layer.provide(HttpApiMiddleware.layerProblemDetails()),
    Layer.provide(D1Client.layer({ db: env.DB })),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(SyncScheduler),
  )

export const makeHandler = (env: Cloudflare.Env) => HttpRouter.toWebHandler(makeApp(env))
