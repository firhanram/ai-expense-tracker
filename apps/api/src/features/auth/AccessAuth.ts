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

/** Methods that change something, and so must come from the app's own pages. */
const unsafeMethods = new Set(["POST", "PATCH", "PUT", "DELETE"])

const urlOf = (url: string | undefined) => {
  if (url === undefined) return undefined
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

/**
 * True when the browser says the request came from the app's own origin:
 * `Sec-Fetch-Site: same-origin`, or, from a browser that sends no
 * `Sec-Fetch-Site`, an `Origin` equal to the request's. A request with
 * neither is refused too.
 */
const isSameOrigin = (request: HttpServerRequest.HttpServerRequest, url: URL | undefined) => {
  const site = request.headers["sec-fetch-site"]
  if (site !== undefined) return site === "same-origin"
  const origin = urlOf(request.headers["origin"])
  return origin !== undefined && url !== undefined && origin.origin === url.origin
}

const unauthorized = () =>
  errorResponse("UNAUTHORIZED", "A valid Cloudflare Access token is required.")

const crossSite = () =>
  errorResponse("CROSS_SITE_REQUEST", "This request must come from the app's own pages.")

/**
 * Two checks before any route runs (ADR-0011), global so they also cover
 * paths no route matches:
 *
 * - Same origin: an unsafe method must come from the app's own pages.
 *   Access's cookie rides along with any request the browser sends here, a
 *   cross-site form POST included, so a valid token alone does not show the
 *   owner meant it. Applies on loopback too.
 * - Access token: a valid `Cf-Access-Jwt-Assertion` on every route but
 *   health, so "not public" holds even on a route to the Worker that Access
 *   does not cover. A missing team domain or AUD tag refuses everything
 *   rather than letting everything in.
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
        const url = urlOf(request.originalUrl)
        if (unsafeMethods.has(request.method) && !isSameOrigin(request, url)) {
          return yield* crossSite()
        }
        const path = new URL(request.url, "http://localhost").pathname
        if (publicPaths.has(path) || (url !== undefined && loopbackHosts.has(url.hostname))) {
          return yield* httpEffect
        }
        const token = request.headers["cf-access-jwt-assertion"]
        const valid = token !== undefined && (yield* Effect.promise(() => verify(token)))
        return yield* valid ? httpEffect : unauthorized()
      }),
    { global: true },
  )
}
