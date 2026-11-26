import { Context, Effect } from "effect"

/** Provides the services `I` to an effect, removing them from what it requires. */
export type Provide<I> = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E, Exclude<R, I>>

/**
 * Reads `services` once, where a handler group or toolkit is built, and
 * returns a function that provides them to an effect run later, per request
 * or per tool call. The store functions (`ExpenseStore`, `SpendingReport`,
 * ...) read their services from context on each call, and a handler may not
 * leave them to the request, so each provides its calls with this:
 *
 *   const withStores = yield* captureServices(SqlClient.SqlClient, ReceiptStore)
 *   handlers.handle("confirm", ({ params }) => withStores(confirmExpense(params.id)))
 */
export const captureServices = <const S extends ReadonlyArray<Context.Key<any, any>>>(
  ...services: S
) =>
  Effect.gen(function* () {
    type I = Context.Service.Identifier<S[number]>
    const context = Context.pick(...services)(yield* Effect.context<I>())
    const provide: Provide<I> = (effect) => Effect.provideContext(effect, context)
    return provide
  })
