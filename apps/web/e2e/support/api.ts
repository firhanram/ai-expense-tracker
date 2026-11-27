import { type ApiFailure, type ApiSuccess, type ErrorCode, errorCatalog } from "@expense/contract"
import type { Page } from "@playwright/test"

/** What a mocked endpoint answers. Build it with `ok`, `fail` or `stream`. */
export interface MockResponse {
  readonly status: number
  readonly contentType: string
  readonly body: string | Buffer
  readonly headers?: Readonly<Record<string, string>> | undefined
}

/** One request the page sent to `/api/*`. */
export interface ApiCall {
  readonly method: string
  /** Path and query, e.g. `/api/expenses?from=2026-11-01`. */
  readonly url: string
  /** Values of the `:name` segments of the matched route key. */
  readonly params: Readonly<Record<string, string>>
  readonly query: URLSearchParams
  /** The parsed JSON body, the raw text if it is not JSON, or null. */
  readonly body: unknown
  /** The body as sent, for a multipart upload; null when there is none. */
  readonly raw: Buffer | null
  readonly contentType: string | null
}

export type MockHandler = MockResponse | ((call: ApiCall) => MockResponse)

/** `{ success: true, data }`, as a JSON endpoint answers. */
export const ok = (data: unknown, status = 200): MockResponse => ({
  status,
  contentType: "application/json",
  body: JSON.stringify({ success: true, data } satisfies ApiSuccess<unknown>),
})

/** `{ success: false, error }` with the code's status; `details` as the contract documents per code. */
export const fail = (
  errorCode: ErrorCode,
  options: { readonly message?: string; readonly details?: unknown } = {},
): MockResponse => ({
  status: errorCatalog[errorCode],
  contentType: "application/json",
  body: JSON.stringify({
    success: false,
    error: {
      errorId: "e2e-error-id",
      errorCode,
      message: options.message ?? errorCode,
      ...(options.details === undefined ? {} : { details: options.details }),
    },
  } satisfies ApiFailure),
})

/** Raw bytes, as `GET /receipts/:key` serves an image. */
export const bytes = (body: Buffer, contentType: string): MockResponse => ({
  status: 200,
  contentType,
  body,
})

/** A `POST /chat` reply: the streamed text, delivered in one body, stored as `messageId`. */
export const stream = (text: string, messageId = "reply-1"): MockResponse => ({
  status: 200,
  contentType: "text/plain; charset=utf-8",
  body: text,
  headers: { "x-chat-message-id": messageId },
})

const matchPath = (pattern: string, path: string): Record<string, string> | undefined => {
  const want = pattern.split("/")
  const got = path.split("/")
  if (want.length !== got.length) return undefined
  const params: Record<string, string> = {}
  for (const [i, segment] of want.entries()) {
    const actual = got[i] ?? ""
    if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(actual)
    else if (segment !== actual) return undefined
  }
  return params
}

const parseBody = (text: string | null): unknown => {
  if (text === null || text === "") return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Answers the page's `/api/*` requests from `routes`, keyed `"METHOD /api/path"`
 * with `:name` segments (`"POST /api/expenses/:id/confirm"`). A request no key
 * matches gets a `NOT_FOUND` envelope, so a missing mock shows up as an error
 * in the UI rather than a hang. Returns every call the page made, in order.
 */
export const mockApi = async (
  page: Page,
  routes: Readonly<Record<string, MockHandler>> = {},
): Promise<{ readonly calls: ReadonlyArray<ApiCall> }> => {
  const calls: Array<ApiCall> = []
  const table = Object.entries(routes).map(([key, handler]) => {
    const [method = "", pattern = ""] = key.split(" ")
    return { method: method.toUpperCase(), pattern, handler }
  })

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const found = table
      .map((entry) => ({ entry, params: matchPath(entry.pattern, url.pathname) }))
      .find(({ entry, params }) => entry.method === method && params !== undefined)
    const call: ApiCall = {
      method,
      url: url.pathname + url.search,
      params: found?.params ?? {},
      query: url.searchParams,
      body: parseBody(request.postData()),
      raw: request.postDataBuffer(),
      contentType: (await request.headerValue("content-type")) ?? null,
    }
    calls.push(call)
    const handler = found?.entry.handler
    const response =
      handler === undefined
        ? fail("NOT_FOUND", { message: `No mock for ${method} ${url.pathname}` })
        : typeof handler === "function"
          ? handler(call)
          : handler
    await route.fulfill({
      status: response.status,
      contentType: response.contentType,
      body: response.body,
      ...(response.headers === undefined ? {} : { headers: response.headers }),
    })
  })

  return { calls }
}
