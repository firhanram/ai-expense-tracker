import { type ErrorCode, errorCatalog } from "@expense/contract"
import { vi } from "vitest"

/** One request the app sent to `/api/*`. */
export interface FakeApiCall {
  readonly method: string
  readonly path: string
  readonly query: URLSearchParams
  readonly body: unknown
}

export interface FakeResponse {
  readonly status: number
  readonly body: unknown
}

export type FakeHandler = FakeResponse | ((call: FakeApiCall) => FakeResponse)

/** `{ success: true, data }`. */
export const ok = (data: unknown, status = 200): FakeResponse => ({
  status,
  body: { success: true, data },
})

/** `{ success: false, error }` with the code's status. */
export const fail = (
  errorCode: ErrorCode,
  options: { readonly message?: string; readonly details?: unknown } = {},
): FakeResponse => ({
  status: errorCatalog[errorCode],
  body: {
    success: false,
    error: {
      errorId: "test-error-id",
      errorCode,
      message: options.message ?? errorCode,
      ...(options.details === undefined ? {} : { details: options.details }),
    },
  },
})

/**
 * Stubs the global `fetch` to answer `/api/*` from `routes`, keyed `"METHOD /api/path"`
 * (exact path; the query is not matched). Unmatched requests get `NOT_FOUND`.
 * Returns the calls, in order. The stub is removed after each test (setup.ts).
 */
export const fakeApi = (
  routes: Readonly<Record<string, FakeHandler>>,
): { readonly calls: ReadonlyArray<FakeApiCall> } => {
  const calls: Array<FakeApiCall> = []
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const text = await request.text()
    const call: FakeApiCall = {
      method: request.method,
      path: url.pathname,
      query: url.searchParams,
      body: text === "" ? null : (JSON.parse(text) as unknown),
    }
    calls.push(call)
    const handler = routes[`${call.method} ${call.path}`]
    const response =
      handler === undefined
        ? fail("NOT_FOUND")
        : typeof handler === "function"
          ? handler(call)
          : handler
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    })
  })
  return { calls }
}
