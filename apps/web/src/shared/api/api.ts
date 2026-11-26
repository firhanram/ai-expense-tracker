import { createApi } from "./client.ts"

/**
 * Where `/api/*` lives: same origin as the Worker, optional token for
 * non-loopback test builds only — never set it for a public deploy. The chat
 * stream, which the typed client cannot read, sends with the same values.
 */
export const apiConnection = {
  baseUrl: window.location.origin,
  token: import.meta.env.VITE_API_TOKEN,
  // Looked up per request, so a test can stub the global `fetch`.
  fetch: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init),
} as const

/** The app's one API caller. */
export const api = createApi(apiConnection)
