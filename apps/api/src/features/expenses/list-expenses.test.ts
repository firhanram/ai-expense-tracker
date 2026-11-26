import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"

// Tests in one file share D1, so each starts from an empty ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

const record = async (merchant: string, occurredAt: string) => {
  const response = await callApi("/api/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 10000, categoryId: 1, merchant, occurredAt }),
  })
  expect(response.status).toBe(201)
}

// No route creates a Draft yet (the agent does, later), so seed one directly.
const seedWithStatus = (merchant: string, status: "draft" | "discarded") =>
  env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, merchant, occurred_at, created_at, status)
     VALUES (?, 10000, 1, ?, '2026-11-30', '2026-11-30T00:00:00.000Z', ?)`,
  )
    .bind(crypto.randomUUID(), merchant, status)
    .run()

const listMerchants = async (path = "/api/expenses") => {
  const response = await callApi(path)
  expect(response.status).toBe(200)
  const expenses: Array<{ merchant: string }> = await response.json()
  return expenses.map((expense) => expense.merchant)
}

describe("GET /api/expenses", () => {
  it("is empty before anything is recorded", async () => {
    expect(await listMerchants()).toEqual([])
  })

  it("lists Expenses newest date first, not in recording order", async () => {
    await record("Indomaret", "2026-11-10")
    await record("Gojek", "2026-11-22")
    await record("PLN", "2026-11-01")

    expect(await listMerchants()).toEqual(["Gojek", "Indomaret", "PLN"])
  })

  it("shows only confirmed Expenses by default", async () => {
    await record("Superindo", "2026-11-05")
    await seedWithStatus("Draft warung", "draft")
    await seedWithStatus("Discarded kopi", "discarded")

    expect(await listMerchants()).toEqual(["Superindo"])
  })

  it("puts the later-recorded Expense first within the same date", async () => {
    await record("Breakfast", "2026-11-15")
    await record("Dinner", "2026-11-15")

    expect(await listMerchants()).toEqual(["Dinner", "Breakfast"])
  })

  it("returns each Expense in the shape POST returned it", async () => {
    const created = await callApi("/api/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: -5000, categoryId: 6, occurredAt: "2026-11-12" }),
    }).then((response) => response.json())

    const listed = await callApi("/api/expenses").then((response) => response.json())

    expect(listed).toEqual([created])
  })

  describe("?status=", () => {
    it("shows only Drafts when asked for drafts", async () => {
      await record("Superindo", "2026-11-05")
      await seedWithStatus("Draft warung", "draft")
      await seedWithStatus("Discarded kopi", "discarded")

      expect(await listMerchants("/api/expenses?status=draft")).toEqual(["Draft warung"])
    })

    it("shows confirmed Expenses when asked for confirmed", async () => {
      await record("Superindo", "2026-11-05")
      await seedWithStatus("Draft warung", "draft")

      expect(await listMerchants("/api/expenses?status=confirmed")).toEqual(["Superindo"])
    })

    it("shows discarded Expenses only when asked for them explicitly", async () => {
      await record("Superindo", "2026-11-05")
      await seedWithStatus("Discarded kopi", "discarded")

      expect(await listMerchants("/api/expenses?status=discarded")).toEqual(["Discarded kopi"])
    })

    it("rejects an unknown status with a 400 naming the field", async () => {
      const response = await callApi("/api/expenses?status=pending")

      expect(response.status).toBe(400)
      const problem: { errors: ReadonlyArray<unknown> } = await response.json()
      expect(problem.errors).toContainEqual(expect.objectContaining({ path: ["query", "status"] }))
    })
  })

  it("marks which Expenses have a Receipt, and which need review", async () => {
    await record("Typed in", "2026-11-02")
    await env.DB.prepare(
      `INSERT INTO expense (id, amount, category_id, merchant, occurred_at, created_at, status, needs_review, receipt_key)
       VALUES (?, 10000, 1, 'From a photo', '2026-11-01', '2026-11-01T00:00:00.000Z', 'confirmed', 1, 'receipt-1')`,
    )
      .bind(crypto.randomUUID())
      .run()

    const expenses: Array<Record<string, unknown>> = await callApi("/api/expenses").then((r) =>
      r.json(),
    )

    expect(expenses).toEqual([
      expect.objectContaining({ merchant: "Typed in", receiptKey: null, needsReview: false }),
      expect.objectContaining({
        merchant: "From a photo",
        receiptKey: "receipt-1",
        needsReview: true,
      }),
    ])
  })
})
