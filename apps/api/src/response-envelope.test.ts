import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi, callWorker } from "./testing/callWorker.ts"
import { anError, readData, readError, uuidPattern } from "./testing/envelope.ts"
import { jpeg, receiptForm } from "./testing/receipts.ts"

// Tests in one file share D1; each starts from an empty ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

const nasiGoreng = { amount: 25000, categoryId: 1, occurredAt: "2026-11-20" }

describe("the success envelope", () => {
  it("wraps health as { success: true, data }", async () => {
    const response = await callApi("/api/health")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: { status: "ok" } })
  })

  it("wraps an Expense, keeping 201 for create", async () => {
    const response = await callApi("/api/expenses", json("POST", nasiGoreng))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      success: true,
      data: expect.objectContaining({ amount: 25000, status: "confirmed" }),
    })
  })

  it("wraps the Expense list", async () => {
    await callApi("/api/expenses", json("POST", nasiGoreng))

    const response = await callApi("/api/expenses")

    expect(await response.json()).toEqual({
      success: true,
      data: [expect.objectContaining({ amount: 25000 })],
    })
  })

  it("answers a delete with 200 and data null, not an empty 204", async () => {
    const created = await readData<{ id: string }>(
      await callApi("/api/expenses", json("POST", nasiGoreng)),
    )

    const response = await callApi(`/api/expenses/${created.id}`, { method: "DELETE" })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: null })
  })

  it("wraps a Report", async () => {
    const response = await callApi("/api/reports?from=2026-11-01&to=2026-11-30&groupBy=month")

    expect(await response.json()).toEqual({
      success: true,
      data: { from: "2026-11-01", to: "2026-11-30", groupBy: "month", total: 0, totals: [] },
    })
  })

  it("wraps a page of the Chat", async () => {
    await env.DB.prepare("DELETE FROM chat_message").run()

    const response = await callApi("/api/chat")

    expect(await response.json()).toEqual({
      success: true,
      data: { messages: [], nextBefore: null },
    })
  })

  it("wraps a Receipt upload, keeping 201", async () => {
    const response = await callApi("/api/receipts", { method: "POST", body: receiptForm(jpeg) })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      success: true,
      data: { receiptKey: expect.any(String) },
    })
  })

  it("serves a Receipt as its bytes, with no envelope", async () => {
    const upload = await callApi("/api/receipts", { method: "POST", body: receiptForm(jpeg) })
    const { receiptKey } = await readData<{ receiptKey: string }>(upload)

    const response = await callApi(`/api/receipts/${receiptKey}`)

    expect(response.headers.get("content-type")).toBe("image/jpeg")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpeg)
  })
})

describe("the error envelope", () => {
  it("carries a uuid errorId, the errorCode and a message", async () => {
    const response = await callWorker("/api/expenses")

    expect(response.status).toBe(401)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(await response.json()).toEqual({
      success: false,
      error: {
        errorId: expect.stringMatching(uuidPattern),
        errorCode: "UNAUTHORIZED",
        message: expect.any(String),
      },
    })
  })

  it("has a different errorId on every response", async () => {
    const first = await readError(await callWorker("/api/expenses"))
    const second = await readError(await callWorker("/api/expenses"))

    expect(first.errorId).not.toBe(second.errorId)
  })

  it.each([
    ["UNAUTHORIZED", 401, () => callWorker("/api/expenses")],
    ["UNAUTHORIZED", 401, () => callWorker("/api/nowhere")],
    ["NOT_FOUND", 404, () => callApi("/api/nowhere")],
    ["VALIDATION_FAILED", 400, () => callApi("/api/expenses?status=lost")],
    [
      "EXPENSE_NOT_FOUND",
      404,
      () => callApi("/api/expenses/no-such-id/confirm", { method: "POST" }),
    ],
    [
      "UNKNOWN_CATEGORY",
      400,
      () => callApi("/api/expenses", json("POST", { ...nasiGoreng, categoryId: 99 })),
    ],
    ["RECEIPT_NOT_FOUND", 404, () => callApi("/api/receipts/no-such-receipt")],
    [
      "INVALID_RECEIPT",
      400,
      () => callApi("/api/receipts", { method: "POST", body: receiptForm(jpeg, "image/gif") }),
    ],
  ] as const)("sends %s with %i", async (errorCode, status, call) => {
    const response = await call()

    expect(response.status).toBe(status)
    expect((await readError(response)).errorCode).toBe(errorCode)
  })

  it("names the field in a VALIDATION_FAILED", async () => {
    const response = await callApi("/api/expenses", json("POST", { ...nasiGoreng, amount: 1.5 }))

    expect(response.status).toBe(400)
    expect(await readError(response)).toEqual(
      anError("VALIDATION_FAILED", {
        issues: [{ path: ["payload", "amount"], message: expect.any(String) }],
      }),
    )
  })

  it("names the id in an EXPENSE_NOT_FOUND", async () => {
    const response = await callApi("/api/expenses/no-such-id", { method: "DELETE" })

    expect(await readError(response)).toEqual(anError("EXPENSE_NOT_FOUND", { id: "no-such-id" }))
  })

  it("answers malformed JSON with VALIDATION_FAILED", async () => {
    const response = await callApi("/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    })

    expect(response.status).toBe(400)
    expect((await readError(response)).errorCode).toBe("VALIDATION_FAILED")
  })
})
