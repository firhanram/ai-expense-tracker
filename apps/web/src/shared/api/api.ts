import { reloadWhenSignedOut } from "./accessSession.ts"
import { createApi } from "./client.ts"

/**
 * Where `/api/*` lives: same origin as the Worker. No credential: Cloudflare
 * Access's cookie travels with every same-origin request (ADR-0011). The chat
 * stream, which the typed client cannot read, sends with the same values, so
 * both treat an expired Access session the same way.
 */
export const apiConnection = {
  baseUrl: window.location.origin,
  // Looked up per request, so a test can stub the global `fetch`.
  fetch: reloadWhenSignedOut(
    (input, init) => globalThis.fetch(input, init),
    () => window.location.reload(),
  ),
} as const

/** The app's one API caller. */
export const api = createApi(apiConnection)
