import { Effect } from "effect"
import { HttpRouter, HttpServerRequest } from "effect/http"
import { errorResponse } from "../../ErrorEnvelope.ts"
import { makeAccessVerifier } from "./AccessToken.ts"

/** Routes reachable without a token. Health stays open so uptime checks need no secret. */
const publicPaths = new Set(["/api/health"])

/**
 * Only `alchemy dev` sees these hosts: on Cloudflare a request is routed by
 * its hostname, so a deployed Worker never does (ADR-0011).
 */
const loopbackHosts = new Set(["localhost", "127.0.0.1"])

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

const unauthorized = () =>
  errorResponse("UNAUTHORIZED", "A valid Cloudflare Access token is required.")

/**
 * Requires a valid `Cf-Access-Jwt-Assertion` on every route but health
 * (ADR-0011), so "not public" holds even on a route to the Worker that
 * Access does not cover. Global, so it also covers paths no route matches:
 * a caller without a token learns nothing about which routes exist. A
 * missing team domain or AUD tag refuses everything rather than letting
 * everything in.
 */
export const AccessAuth = (config: {
  readonly teamDomain: string | undefined
  readonly aud: string | undefined
}) => {
  const { teamDomain, aud } = config
  const verify = teamDomain && aud ? makeAccessVerifier({ teamDomain, aud }) : async () => false

  return HttpRouter.middleware(
    (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const path = new URL(request.url, "http://localhost").pathname
        const host = hostOf(request.originalUrl)
        if (publicPaths.has(path) || (host !== undefined && loopbackHosts.has(host))) {
          return yield* httpEffect
        }
        const token = request.headers["cf-access-jwt-assertion"]
        const valid = token !== undefined && (yield* Effect.promise(() => verify(token)))
        return yield* valid ? httpEffect : unauthorized()
      }),
    { global: true },
  )
}
