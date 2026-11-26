import { createApi } from "./client.ts"

/** Where `/api/*` lives and the bearer token it wants: the Worker's origin, the token baked in at build time. */
export const apiConnection = {
  baseUrl: window.location.origin,
  token: import.meta.env.VITE_API_TOKEN,
  // Looked up per call, so a test that stubs `fetch` after import still answers.
  fetch: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init),
} as const

/** The app's one API caller. */
export const api = createApi(apiConnection)
