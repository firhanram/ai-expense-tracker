import { D1Client } from "@effect/sql-d1"
import { Api } from "@expense/contract"
import { Layer, Scheduler } from "effect"
import type { LanguageModel } from "effect/ai"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder, HttpApiMiddleware } from "effect/http-api"
import { systemPrompt } from "@expense/ui/server"
import { BearerAuth } from "./features/auth/BearerAuth.ts"
import { ChatLive } from "./features/chat/ChatLive.ts"
import { ModelProviderLive } from "./features/chat/ModelProvider.ts"
import { SystemPrompt } from "./features/chat/SystemPrompt.ts"
import { ExpensesLive } from "./features/expenses/ExpensesLive.ts"
import { HealthLive } from "./features/health/HealthLive.ts"

/**
 * Workers run each request's fibers in that request's async context, so the
 * runtime uses a synchronous scheduler (see `HttpRouter.toWebHandler`).
 */
const SyncScheduler = Layer.succeed(Scheduler.Scheduler, new Scheduler.MixedScheduler("sync"))

/** What tests may swap. The model is the S2 seam: tests never reach a real one. */
export interface AppOverrides {
  readonly languageModel?: Layer.Layer<LanguageModel.LanguageModel> | undefined
}

export const makeApp = (env: Cloudflare.Env, overrides: AppOverrides = {}) =>
  Layer.mergeAll(HttpApiBuilder.layer(Api), BearerAuth(env.API_TOKEN)).pipe(
    Layer.provide([HealthLive, ExpensesLive, ChatLive]),
    // The model is told what the component library lets it render (ADR-0006).
    Layer.provide(Layer.succeed(SystemPrompt, systemPrompt)),
    Layer.provide(
      overrides.languageModel ??
        ModelProviderLive({
          provider: env.MODEL_PROVIDER,
          model: env.MODEL_NAME,
          apiKey: env.API_PROVIDER_KEY,
        }),
    ),
    // Request validation 400s name the offending field; 500s still carry no detail.
    Layer.provide(HttpApiMiddleware.layerProblemDetails({ includeDetails: true })),
    Layer.provide(D1Client.layer({ db: env.DB })),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(SyncScheduler),
  )

export const makeHandler = (env: Cloudflare.Env, overrides?: AppOverrides) =>
  HttpRouter.toWebHandler(makeApp(env, overrides))
