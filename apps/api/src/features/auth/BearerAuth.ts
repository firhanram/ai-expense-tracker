import { Effect } from "effect"
import { HttpRouter, HttpServerRequest } from "effect/http"
import { errorResponse } from "../../ErrorEnvelope.ts"

/** Routes reachable without the token. Health stays open so uptime checks need no secret. */
const publicPaths = new Set(["/api/health"])

const unauthorized = () =>
  errorResponse("UNAUTHORIZED", "A valid bearer token is required.", {
    headers: { "www-authenticate": "Bearer" },
  })

const encoder = new TextEncoder()

/** Constant-time, so response timing does not leak how much of a guess matched. */
const tokenMatches = (header: string | undefined, apiToken: string) => {
  const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined
  // `!apiToken`, not `=== ""`: an unbound secret arrives as `undefined` at runtime.
  if (presented === undefined || !apiToken) return false
  const a = encoder.encode(presented)
  const b = encoder.encode(apiToken)
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b)
}

/**
 * Requires `Authorization: Bearer $API_TOKEN` on every route but health.
 * Global, so it also covers paths no route matches: a caller without the
 * token learns nothing about which routes exist. An empty or missing
 * `API_TOKEN` rejects everything rather than letting everything in.
 */
export const BearerAuth = (apiToken: string) =>
  HttpRouter.middleware(
    (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const path = new URL(request.url, "http://localhost").pathname
        if (publicPaths.has(path) || tokenMatches(request.headers.authorization, apiToken)) {
          return yield* httpEffect
        }
        return yield* unauthorized()
      }),
    { global: true },
  )
