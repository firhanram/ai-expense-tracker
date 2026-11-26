import { D1Client } from "@effect/sql-d1"
import { Api } from "@expense/contract"
import { Effect, Layer, Scheduler } from "effect"
import type { LanguageModel } from "effect/ai"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { systemPrompt } from "@expense/ui/server"
import { ApiErrorsLive, ErrorEnvelope } from "./ErrorEnvelope.ts"
import { AccessAuth } from "./features/auth/AccessAuth.ts"
import { ChatLive } from "./features/chat/ChatLive.ts"
import { ModelProviderLive } from "./features/chat/ModelProvider.ts"
import { SystemPrompt } from "./features/chat/SystemPrompt.ts"
import { ExpensesLive } from "./features/expenses/ExpensesLive.ts"
import { HealthLive } from "./features/health/HealthLive.ts"
import { sweepOrphanReceipts } from "./features/receipts/OrphanSweep.ts"
import { ReceiptsLive } from "./features/receipts/ReceiptsLive.ts"
import { ReceiptStoreLive } from "./features/receipts/ReceiptStore.ts"
import { ReportsLive } from "./features/reports/ReportsLive.ts"

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
  Layer.mergeAll(
    HttpApiBuilder.layer(Api),
    AccessAuth({ teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD }),
    ErrorEnvelope,
  ).pipe(
    Layer.provide([HealthLive, ExpensesLive, ChatLive, ReportsLive, ReceiptsLive]),
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
    // The error envelope (PLAN, "API"): validation 400s name the field; 500s carry no detail.
    Layer.provide(ApiErrorsLive),
    Layer.provide(ReceiptStoreLive(env.RECEIPTS)),
    Layer.provide(D1Client.layer({ db: env.DB })),
    Layer.provide(HttpServer.layerServices),
    Layer.provideMerge(SyncScheduler),
  )

export const makeHandler = (env: Cloudflare.Env, overrides?: AppOverrides) =>
  HttpRouter.toWebHandler(makeApp(env, overrides))

/**
 * The cron trigger: sweeps Receipts no Expense holds (`OrphanSweep.ts`).
 * `scheduledTime` is when the trigger was due, so the cutoff does not drift
 * with how late it ran.
 */
export const runScheduled = (env: Cloudflare.Env, scheduledTime: number) =>
  sweepOrphanReceipts(new Date(scheduledTime)).pipe(
    Effect.tap((deleted) => Effect.logInfo(`Swept ${deleted} orphan Receipts`)),
    Effect.provide(
      Layer.mergeAll(ReceiptStoreLive(env.RECEIPTS), D1Client.layer({ db: env.DB }), SyncScheduler),
    ),
    Effect.runPromise,
  )
