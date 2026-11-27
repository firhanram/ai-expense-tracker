import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"
import { anError, readData, readError } from "../../testing/envelope.ts"

// Tests in one file share D1, so each starts from an empty ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

const seed = async (status: "draft" | "confirmed" | "discarded") => {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, merchant, occurred_at, created_at, status, needs_review)
     VALUES (?, 70000, 6, 'Uniqlo', '2026-11-24', '2026-11-24T08:00:00.000Z', ?, 1)`,
  )
    .bind(id, status)
    .run()
  return id
}

describe("GET /api/expenses/:id", () => {
  for (const status of ["draft", "confirmed", "discarded"] as const) {
    it(`returns a ${status} Expense by id`, async () => {
      const id = await seed(status)

      const response = await callApi(`/api/expenses/${id}`)

      expect(response.status).toBe(200)
      expect(await readData(response)).toEqual({
        id,
        amount: 70000,
        categoryId: 6,
        merchant: "Uniqlo",
        note: null,
        occurredAt: "2026-11-24",
        createdAt: "2026-11-24T08:00:00.000Z",
        status,
        needsReview: true,
        receiptKey: null,
      })
    })
  }

  it("is a 404 for an Expense that does not exist", async () => {
    const response = await callApi("/api/expenses/no-such-id")

    expect(response.status).toBe(404)
    expect(await readError(response)).toEqual(anError("EXPENSE_NOT_FOUND", { id: "no-such-id" }))
  })
})
