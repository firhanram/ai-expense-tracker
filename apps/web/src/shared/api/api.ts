import { createApi } from "./client.ts"

/** The app's one API caller: same origin as the Worker, optional token for non-loopback test builds only — never set it for a public deploy. */
export const api = createApi({
  baseUrl: window.location.origin,
  token: import.meta.env.VITE_API_TOKEN,
  // Looked up per request, so a test can stub the global `fetch`.
  fetch: (input, init) => globalThis.fetch(input, init),
})
