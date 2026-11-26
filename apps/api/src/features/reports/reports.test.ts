import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"

// Tests in one file share D1, so each starts from an empty ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

/** Records a confirmed Expense the way the user does by hand. */
const record = async (amount: number, categoryId: number, occurredAt: string) => {
  const response = await callApi("/api/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount, categoryId, occurredAt }),
  })
  expect(response.status).toBe(201)
}

const report = async (query: string) => {
  const response = await callApi(`/api/reports?${query}`)
  expect(response.status).toBe(200)
  return response.json()
}

describe("GET /api/reports", () => {
  it("sums confirmed Expenses by Category, in Category order", async () => {
    await record(30000, 3, "2026-11-02")
    await record(15000, 2, "2026-11-03")
    await record(25000, 2, "2026-11-20")

    expect(await report("from=2026-11-01&to=2026-11-30&groupBy=category")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
      groupBy: "category",
      total: 70000,
      totals: [
        { label: "Dining", categoryId: 2, amount: 40000 },
        { label: "Transport", categoryId: 3, amount: 30000 },
      ],
    })
  })

  it("counts confirmed Expenses only, never Drafts or discarded ones", async () => {
    await record(20000, 2, "2026-11-05")
    // Only the agent creates Drafts, so they are written directly here.
    await env.DB.prepare(
      `INSERT INTO expense (id, amount, category_id, occurred_at, created_at, status)
       VALUES ('draft-1', 50000, 2, '2026-11-06', '2026-11-06T00:00:00Z', 'draft'),
              ('gone-1', 70000, 3, '2026-11-07', '2026-11-07T00:00:00Z', 'discarded')`,
    ).run()

    expect(await report("from=2026-11-01&to=2026-11-30&groupBy=category")).toMatchObject({
      total: 20000,
      totals: [{ label: "Dining", categoryId: 2, amount: 20000 }],
    })
  })

  it("nets refunds out of their Category and the total", async () => {
    await record(100000, 6, "2026-11-10")
    await record(-40000, 6, "2026-11-12")
    await record(10000, 2, "2026-11-12")

    expect(await report("from=2026-11-01&to=2026-11-30&groupBy=category")).toMatchObject({
      total: 70000,
      totals: [
        { label: "Dining", amount: 10000 },
        { label: "Shopping", amount: 60000 },
      ],
    })
  })

  it("sums by month, oldest first, with each month's first and last day in that month", async () => {
    await record(10000, 1, "2026-09-30")
    await record(20000, 1, "2026-10-01")
    await record(30000, 2, "2026-10-31")
    await record(-5000, 2, "2026-10-15")
    await record(40000, 3, "2026-11-01")

    expect(await report("from=2026-09-01&to=2026-11-30&groupBy=month")).toEqual({
      from: "2026-09-01",
      to: "2026-11-30",
      groupBy: "month",
      total: 95000,
      totals: [
        { label: "2026-09", categoryId: null, amount: 10000 },
        { label: "2026-10", categoryId: null, amount: 45000 },
        { label: "2026-11", categoryId: null, amount: 40000 },
      ],
    })
  })

  it("includes both ends of the range and nothing outside it", async () => {
    await record(1000, 1, "2026-10-31")
    await record(2000, 1, "2026-11-01")
    await record(4000, 1, "2026-11-30")
    await record(8000, 1, "2026-12-01")

    expect(await report("from=2026-11-01&to=2026-11-30&groupBy=month")).toMatchObject({
      total: 6000,
      totals: [{ label: "2026-11", amount: 6000 }],
    })
  })

  it("is an empty Report with a zero total when nothing is recorded in the range", async () => {
    await record(1000, 1, "2026-10-31")

    expect(await report("from=2026-11-01&to=2026-11-30&groupBy=category")).toMatchObject({
      total: 0,
      totals: [],
    })
  })

  describe("rejects a query the client must complete with a 400 naming the field", () => {
    it.each([
      ["no from", "to=2026-11-30&groupBy=category", "from"],
      ["no to", "from=2026-11-01&groupBy=category", "to"],
      ["no groupBy", "from=2026-11-01&to=2026-11-30", "groupBy"],
      [
        "a groupBy other than category or month",
        "from=2026-11-01&to=2026-11-30&groupBy=week",
        "groupBy",
      ],
      ["a malformed from", "from=11/2026&to=2026-11-30&groupBy=month", "from"],
      ["a to date that does not exist", "from=2026-11-01&to=2026-11-31&groupBy=month", "to"],
    ])("%s", async (_, query, field) => {
      const response = await callApi(`/api/reports?${query}`)

      expect(response.status).toBe(400)
      const problem: { errors: ReadonlyArray<unknown> } = await response.json()
      expect(problem.errors).toContainEqual(expect.objectContaining({ path: ["query", field] }))
    })
  })
})
