import type { Expense } from "@expense/contract"
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"

const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

const record = async (): Promise<Expense> => {
  const response = await callApi(
    "/api/expenses",
    json("POST", {
      amount: 25000,
      categoryId: 2,
      merchant: "Warung Bu Tini",
      note: "lunch",
      occurredAt: "2026-11-20",
    }),
  )
  expect(response.status).toBe(201)
  return response.json()
}

// No route creates a Draft yet (the agent does, later), so seed rows directly.
const seedWithStatus = async (status: "draft" | "discarded") => {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, merchant, occurred_at, created_at, status)
     VALUES (?, 10000, 1, 'Indomaret', '2026-11-30', '2026-11-30T00:00:00.000Z', ?)`,
  )
    .bind(id, status)
    .run()
  return id
}

const edit = (id: string, body: unknown) => callApi(`/api/expenses/${id}`, json("PATCH", body))

describe("PATCH /api/expenses/:id", () => {
  it("edits every editable field of a confirmed Expense and returns it", async () => {
    const expense = await record()

    const response = await edit(expense.id, {
      amount: 32000,
      categoryId: 3,
      merchant: "Gojek",
      note: "ride home",
      occurredAt: "2026-10-30",
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ...expense,
      amount: 32000,
      categoryId: 3,
      merchant: "Gojek",
      note: "ride home",
      occurredAt: "2026-10-30",
    })
  })

  it("changes only the fields sent, and null clears merchant or note", async () => {
    const expense = await record()

    const response = await edit(expense.id, { amount: 27000, note: null })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...expense, amount: 27000, note: null })
  })

  it("shows the edit in the list", async () => {
    const expense = await record()
    await edit(expense.id, { merchant: "Warung Pak Darto" })

    const listed: Array<Expense> = await callApi("/api/expenses").then((r) => r.json())

    expect(listed.find((e) => e.id === expense.id)).toMatchObject({ merchant: "Warung Pak Darto" })
  })

  it("edits a Draft and leaves it a Draft", async () => {
    const id = await seedWithStatus("draft")

    const response = await edit(id, { amount: 12500, categoryId: 2 })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id,
      amount: 12500,
      categoryId: 2,
      merchant: "Indomaret",
      status: "draft",
    })
  })

  describe("returns 404 ExpenseNotFound", () => {
    it("for an id that does not exist", async () => {
      const response = await edit("no-such-expense", { amount: 1000 })

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ _tag: "ExpenseNotFound", id: "no-such-expense" })
    })

    it("for an empty edit of an id that does not exist", async () => {
      const response = await edit("no-such-expense", {})

      expect(response.status).toBe(404)
    })

    it("for a discarded Expense, which the user can no longer reach", async () => {
      const id = await seedWithStatus("discarded")

      const response = await edit(id, { amount: 1000 })

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ _tag: "ExpenseNotFound", id })
    })
  })

  describe("rejects invalid input with a 400 and changes nothing", () => {
    it("an unknown Category", async () => {
      const expense = await record()

      const response = await edit(expense.id, { categoryId: 99, amount: 1 })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ _tag: "UnknownCategory", categoryId: 99 })
      const listed: Array<Expense> = await callApi("/api/expenses").then((r) => r.json())
      expect(listed.find((e) => e.id === expense.id)).toEqual(expense)
    })

    it.each([
      ["a fractional amount", { amount: 1500.5 }, "amount"],
      ["a date that does not exist", { occurredAt: "2026-02-30" }, "occurredAt"],
    ])("%s, naming the field", async (_, body, field) => {
      const expense = await record()

      const response = await edit(expense.id, body)

      expect(response.status).toBe(400)
      const problem: { errors: ReadonlyArray<unknown> } = await response.json()
      expect(problem.errors).toContainEqual(expect.objectContaining({ path: ["payload", field] }))
    })
  })
})
