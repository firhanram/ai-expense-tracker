import { Api } from "@expense/contract"
import { Cause, Effect, Exit } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"
import { type HttpApi, HttpApiClient } from "effect/http-api"

/** The typed client for the whole contract: `client.expenses.list(...)`, `client.health.check()`. */
export type ApiClient =
  typeof Api extends HttpApi.HttpApi<string, infer Groups> ? HttpApiClient.Client<Groups> : never

export interface ApiOptions {
  /** The origin serving `/api/*`; the SPA's own, since the Worker serves both. */
  readonly baseUrl: string
  /** The bearer token. Omitted when the deployment sends none. */
  readonly token?: string | undefined
  readonly fetch?: typeof globalThis.fetch | undefined
}

/**
 * Calls one endpoint and returns a Promise for TanStack Query. The envelope
 * is already gone: it resolves with the payload, and rejects with the
 * contract's tagged error for the `errorCode` (`_tag: "ExpenseNotFound"`), or
 * an `HttpClientError` when the request never got an answer.
 */
export type CallApi = <A, E>(call: (client: ApiClient) => Effect.Effect<A, E>) => Promise<A>

export const createApi = (options: ApiOptions): CallApi => {
  const client = HttpApiClient.make(Api, {
    baseUrl: options.baseUrl,
    transformClient: (http) =>
      options.token === undefined || options.token === ""
        ? http
        : HttpClient.mapRequest(http, HttpClientRequest.bearerToken(options.token)),
  }).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, options.fetch ?? globalThis.fetch),
  )

  return async (call) => {
    const exit = await Effect.runPromiseExit(Effect.flatMap(client, call))
    if (Exit.isSuccess(exit)) return exit.value
    throw Cause.squash(exit.cause)
  }
}
