import type { Expense } from "@expense/contract"
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"

const record = async (merchant: string): Promise<Expense> => {
  const response = await callApi("/api/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 10000, categoryId: 1, merchant, occurredAt: "2026-11-01" }),
  })
  expect(response.status).toBe(201)
  return response.json()
}

// No route creates a Draft yet (the agent does, later), so seed one directly.
const seedDraft = async () => {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, merchant, occurred_at, created_at, status)
     VALUES (?, 10000, 1, 'Draft warung', '2026-11-30', '2026-11-30T00:00:00.000Z', 'draft')`,
  )
    .bind(id)
    .run()
  return id
}

const remove = (id: string) => callApi(`/api/expenses/${id}`, { method: "DELETE" })

const listedIds = async () => {
  const expenses: Array<Expense> = await callApi("/api/expenses").then((r) => r.json())
  return expenses.map((expense) => expense.id)
}

describe("DELETE /api/expenses/:id", () => {
  it("removes a confirmed Expense from the list and leaves the others", async () => {
    const kept = await record("Superindo")
    const deleted = await record("Indomaret")

    const response = await remove(deleted.id)

    expect(response.status).toBe(204)
    const ids = await listedIds()
    expect(ids).toContain(kept.id)
    expect(ids).not.toContain(deleted.id)
  })

  it("is a hard delete: the same id is not found afterwards", async () => {
    const expense = await record("Gojek")
    await remove(expense.id)

    const again = await remove(expense.id)

    expect(again.status).toBe(404)
    const edit = await callApi(`/api/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 1 }),
    })
    expect(edit.status).toBe(404)
  })

  it("deletes a Draft", async () => {
    const id = await seedDraft()

    expect((await remove(id)).status).toBe(204)
    expect((await remove(id)).status).toBe(404)
  })

  it("returns 404 ExpenseNotFound for an id that does not exist", async () => {
    const response = await remove("no-such-expense")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ _tag: "ExpenseNotFound", id: "no-such-expense" })
  })
})
