import worker from "../index.ts"

/** The `API_TOKEN` the test Worker is bound with (see `vitest.config.ts`). */
export const testApiToken = "test-api-token"

/**
 * S1 seam: calls the Worker's fetch handler in workerd against the local D1.
 * No socket, no deploy. Sends no token; `callApi` is the authorised call.
 */
export const callWorker = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://localhost${path}`, init))

/** `callWorker` as the SPA calls it: with the bearer token. */
export const callApi = (path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers)
  headers.set("authorization", `Bearer ${testApiToken}`)
  return callWorker(path, { ...init, headers })
}
