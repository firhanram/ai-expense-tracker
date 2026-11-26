import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"
import { readData, readIssues } from "../../testing/envelope.ts"

// Tests in one file share D1, so each starts from an empty ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

const record = async (merchant: string, occurredAt: string, categoryId = 1) => {
  const response = await callApi("/api/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 10000, categoryId, merchant, occurredAt }),
  })
  expect(response.status).toBe(201)
}

const listMerchants = async (query: string) => {
  const response = await callApi(`/api/expenses?${query}`)
  expect(response.status).toBe(200)
  const expenses: Array<{ merchant: string }> = await readData(response)
  return expenses.map((expense) => expense.merchant)
}

describe("GET /api/expenses filters", () => {
  it("from keeps Expenses on or after the date", async () => {
    await record("October rent", "2026-10-31")
    await record("First of November", "2026-11-01")
    await record("Mid November", "2026-11-15")

    expect(await listMerchants("from=2026-11-01")).toEqual(["Mid November", "First of November"])
  })

  it("to keeps Expenses on or before the date", async () => {
    await record("Mid November", "2026-11-15")
    await record("Last of November", "2026-11-30")
    await record("First of December", "2026-12-01")

    expect(await listMerchants("to=2026-11-30")).toEqual(["Last of November", "Mid November"])
  })

  it("categoryId keeps Expenses in that Category", async () => {
    await record("Warung", "2026-11-10", 2)
    await record("Gojek", "2026-11-11", 3)
    await record("Bakso", "2026-11-12", 2)

    expect(await listMerchants("categoryId=2")).toEqual(["Bakso", "Warung"])
  })

  it("a month and a Category together keep only that Category within the month, both ends included", async () => {
    await record("Food, last day of October", "2026-10-31", 2)
    await record("Food, first day of November", "2026-11-01", 2)
    await record("Transport, mid November", "2026-11-15", 3)
    await record("Food, last day of November", "2026-11-30", 2)
    await record("Food, first day of December", "2026-12-01", 2)

    expect(await listMerchants("from=2026-11-01&to=2026-11-30&categoryId=2")).toEqual([
      "Food, last day of November",
      "Food, first day of November",
    ])
  })

  it("a February month range ends on its last real day", async () => {
    await record("Last of February", "2026-02-28", 2)
    await record("First of March", "2026-03-01", 2)

    expect(await listMerchants("from=2026-02-01&to=2026-02-28")).toEqual(["Last of February"])
  })

  it("a Category with nothing recorded in the month lists nothing", async () => {
    await record("Food in November", "2026-11-10", 2)

    expect(await listMerchants("from=2026-11-01&to=2026-11-30&categoryId=3")).toEqual([])
  })

  describe("rejects an invalid filter with a 400 naming it", () => {
    it.each([
      ["a malformed from", "from=11/2026", "from"],
      ["a to date that does not exist", "to=2026-11-31", "to"],
      ["a non-numeric categoryId", "categoryId=food", "categoryId"],
      ["a fractional categoryId", "categoryId=1.5", "categoryId"],
    ])("%s", async (_, query, field) => {
      const response = await callApi(`/api/expenses?${query}`)

      expect(response.status).toBe(400)
      const issues = await readIssues(response)
      expect(issues).toContainEqual(expect.objectContaining({ path: ["query", field] }))
    })
  })
})
