import { describe, expect, it } from "vitest"
import { createApi } from "./client.ts"

interface Sent {
  readonly url: string
  readonly method: string
  readonly authorization: string | null
}

/** A `fetch` that answers every request with `body` and records what was sent. */
const answering =
  (status: number, body: unknown, sent: Array<Sent> = []): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init)
    sent.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get("authorization"),
    })
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  }

const expense = {
  id: "e1",
  amount: 70000,
  categoryId: 8,
  merchant: "Uniqlo",
  note: null,
  occurredAt: "2026-11-24",
  createdAt: "2026-11-24T03:00:00.000Z",
  status: "draft",
  needsReview: false,
  receiptKey: null,
}

describe("the API client", () => {
  it("resolves with the payload of a success envelope", async () => {
    const api = createApi({
      baseUrl: "http://app.test",
      fetch: answering(200, { success: true, data: { status: "ok" } }),
    })

    await expect(api((client) => client.health.check())).resolves.toEqual({ status: "ok" })
  })

  it("sends the bearer token to the same-origin /api path", async () => {
    const sent: Array<Sent> = []
    const api = createApi({
      baseUrl: "http://app.test",
      token: "secret",
      fetch: answering(200, { success: true, data: expense }, sent),
    })

    await api((client) => client.expenses.confirm({ params: { id: "e1" } }))

    expect(sent).toEqual([
      {
        url: "http://app.test/api/expenses/e1/confirm",
        method: "POST",
        authorization: "Bearer secret",
      },
    ])
  })

  it("sends no Authorization header when no token is configured", async () => {
    const sent: Array<Sent> = []
    const api = createApi({
      baseUrl: "http://app.test",
      fetch: answering(200, { success: true, data: { status: "ok" } }, sent),
    })

    await api((client) => client.health.check())

    expect(sent[0]?.authorization).toBeNull()
  })

  it("rejects with the error named by a failure envelope's errorCode", async () => {
    const api = createApi({
      baseUrl: "http://app.test",
      fetch: answering(404, {
        success: false,
        error: {
          errorId: "err-1",
          errorCode: "EXPENSE_NOT_FOUND",
          message: "No Expense has the id e9.",
          details: { id: "e9" },
        },
      }),
    })

    await expect(
      api((client) => client.expenses.confirm({ params: { id: "e9" } })),
    ).rejects.toMatchObject({ _tag: "ExpenseNotFound", id: "e9", errorId: "err-1" })
  })

  it("rejects with Unauthorized when the token is refused", async () => {
    const api = createApi({
      baseUrl: "http://app.test",
      fetch: answering(401, {
        success: false,
        error: {
          errorId: "err-2",
          errorCode: "UNAUTHORIZED",
          message: "A valid bearer token is required.",
        },
      }),
    })

    await expect(api((client) => client.expenses.list({ query: {} }))).rejects.toMatchObject({
      _tag: "Unauthorized",
    })
  })
})
