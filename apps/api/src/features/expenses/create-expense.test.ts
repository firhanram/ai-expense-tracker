import type { Expense } from "@expense/contract"
import { describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"

const createExpense = (body: unknown) =>
  callApi("/api/expenses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

const nasiGoreng = {
  amount: 25000,
  categoryId: 2,
  merchant: "Warung Bu Tini",
  note: "lunch",
  occurredAt: "2026-11-20",
}

describe("POST /api/expenses", () => {
  it("records a confirmed Expense and returns it", async () => {
    const response = await createExpense(nasiGoreng)

    expect(response.status).toBe(201)
    const expense: Expense = await response.json()
    expect(expense).toMatchObject({
      amount: 25000,
      categoryId: 2,
      merchant: "Warung Bu Tini",
      note: "lunch",
      occurredAt: "2026-11-20",
      status: "confirmed",
      needsReview: false,
    })
    expect(expense.id).toEqual(expect.any(String))
    expect(Date.parse(expense.createdAt)).not.toBeNaN()
  })

  it("accepts a negative amount as a refund", async () => {
    const response = await createExpense({ ...nasiGoreng, amount: -25000 })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ amount: -25000 })
  })

  it("leaves merchant and note empty when omitted", async () => {
    const response = await createExpense({ amount: 15000, categoryId: 3, occurredAt: "2026-11-21" })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ merchant: null, note: null })
  })

  describe("rejects invalid input with a 400", () => {
    it("an unknown Category", async () => {
      const response = await createExpense({ ...nasiGoreng, categoryId: 99 })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ _tag: "UnknownCategory", categoryId: 99 })
    })

    it.each([
      ["a fractional amount", { amount: 1500.5 }, "amount"],
      ["an amount given as a string", { amount: "25000" }, "amount"],
      ["a malformed date", { occurredAt: "20/11/2026" }, "occurredAt"],
      ["a date that does not exist", { occurredAt: "2026-02-30" }, "occurredAt"],
      ["a missing date", { occurredAt: undefined }, "occurredAt"],
    ])("%s, naming the field", async (_, override, field) => {
      const response = await createExpense({ ...nasiGoreng, ...override })

      expect(response.status).toBe(400)
      expect(response.headers.get("content-type")).toContain("application/problem+json")
      const problem: { errors: ReadonlyArray<unknown> } = await response.json()
      expect(problem.errors).toContainEqual(expect.objectContaining({ path: ["payload", field] }))
    })
  })
})
