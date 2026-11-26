import type { Expense } from "@expense/contract"
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"
import { jpeg, uploadReceipt } from "../../testing/receipts.ts"

// Tests in one file share D1, so each starts from an empty ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

// No route creates a Draft yet (the agent does, later), so seed one directly.
const seed = async (status: "draft" | "confirmed" | "discarded") => {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, merchant, occurred_at, created_at, status)
     VALUES (?, 32000, 1, 'Kopi Kenangan', '2026-11-24', '2026-11-24T08:00:00.000Z', ?)`,
  )
    .bind(id, status)
    .run()
  return id
}

const post = (path: string) => callApi(path, { method: "POST" })

const list = async (status?: string) => {
  const response = await callApi(
    status === undefined ? "/api/expenses" : `/api/expenses?status=${status}`,
  )
  const expenses: Array<Expense> = await response.json()
  return expenses.map((expense) => expense.id)
}

describe("POST /api/expenses/:id/confirm", () => {
  it("makes a Draft a confirmed Expense on the same row", async () => {
    const id = await seed("draft")

    const response = await post(`/api/expenses/${id}/confirm`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id,
      amount: 32000,
      merchant: "Kopi Kenangan",
      status: "confirmed",
    })
    expect(await list()).toEqual([id])
    expect(await list("draft")).toEqual([])
  })

  it("succeeds and changes nothing when confirmed again, recording one Expense", async () => {
    const id = await seed("draft")

    const first = await post(`/api/expenses/${id}/confirm`)
    const second = await post(`/api/expenses/${id}/confirm`)

    expect(second.status).toBe(200)
    expect(await second.json()).toEqual(await first.json())
    expect(await list()).toEqual([id])
  })

  it("records one Expense when two confirms race", async () => {
    const id = await seed("draft")

    const responses = await Promise.all([
      post(`/api/expenses/${id}/confirm`),
      post(`/api/expenses/${id}/confirm`),
    ])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(await list()).toEqual([id])
  })

  it("refuses to confirm a discarded Expense with a 409", async () => {
    const id = await seed("discarded")

    const response = await post(`/api/expenses/${id}/confirm`)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ _tag: "ExpenseDiscarded", id })
    expect(await list()).toEqual([])
    expect(await list("discarded")).toEqual([id])
  })

  it("is a 404 for an Expense that does not exist", async () => {
    const response = await post("/api/expenses/no-such-id/confirm")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ _tag: "ExpenseNotFound", id: "no-such-id" })
  })
})

describe("POST /api/expenses/:id/discard", () => {
  it("keeps the row with a discarded status and drops it from the default views", async () => {
    const id = await seed("draft")

    const response = await post(`/api/expenses/${id}/discard`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id, status: "discarded" })
    expect(await list()).toEqual([])
    expect(await list("draft")).toEqual([])
    expect(await list("discarded")).toEqual([id])
  })

  it("succeeds and changes nothing when discarded again", async () => {
    const id = await seed("draft")

    const first = await post(`/api/expenses/${id}/discard`)
    const second = await post(`/api/expenses/${id}/discard`)

    expect(second.status).toBe(200)
    expect(await second.json()).toEqual(await first.json())
  })

  it("deletes the Draft's Receipt, since it never became an Expense", async () => {
    const { receiptKey } = await uploadReceipt(jpeg)
    const id = await seed("draft")
    await env.DB.prepare("UPDATE expense SET receipt_key = ? WHERE id = ?")
      .bind(receiptKey, id)
      .run()

    const response = await post(`/api/expenses/${id}/discard`)

    expect(await response.json()).toMatchObject({ id, status: "discarded", receiptKey: null })
    expect((await callApi(`/api/receipts/${receiptKey}`)).status).toBe(404)
  })

  it("keeps the Receipt of a confirmed Expense it refuses to discard", async () => {
    const { receiptKey } = await uploadReceipt(jpeg)
    const id = await seed("confirmed")
    await env.DB.prepare("UPDATE expense SET receipt_key = ? WHERE id = ?")
      .bind(receiptKey, id)
      .run()

    expect((await post(`/api/expenses/${id}/discard`)).status).toBe(409)
    expect((await callApi(`/api/receipts/${receiptKey}`)).status).toBe(200)
  })

  it("refuses to discard a confirmed Expense with a 409", async () => {
    const id = await seed("confirmed")

    const response = await post(`/api/expenses/${id}/discard`)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ _tag: "ExpenseConfirmed", id })
    expect(await list()).toEqual([id])
  })

  it("is a 404 for an Expense that does not exist", async () => {
    const response = await post("/api/expenses/no-such-id/discard")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ _tag: "ExpenseNotFound", id: "no-such-id" })
  })
})
