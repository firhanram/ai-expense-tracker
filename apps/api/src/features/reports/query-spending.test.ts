import { D1Client } from "@effect/sql-d1"
import { env } from "cloudflare:workers"
import { Effect, type Schema, Stream } from "effect"
import { Toolkit } from "effect/ai"
import { beforeEach, describe, expect, it } from "vitest"
import { QuerySpending, QuerySpendingHandler } from "./QuerySpending.ts"

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
})

const insert = (
  id: string,
  amount: number,
  categoryId: number,
  occurredAt: string,
  status: string,
) =>
  env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, occurred_at, created_at, status)
     VALUES (?, ?, ?, ?, '2026-11-25T00:00:00Z', ?)`,
  )
    .bind(id, amount, categoryId, occurredAt, status)
    .run()

const Tools = Toolkit.make(QuerySpending)

/** Calls the tool as `LanguageModel` does with the model's JSON params, and returns what the model reads back. */
const callTool = (params: Schema.Json) =>
  Effect.gen(function* () {
    const handler = yield* QuerySpendingHandler
    const toolkit = yield* Tools.pipe(Effect.provide(Tools.toLayer({ query_spending: handler })))
    const results = yield* toolkit
      .handle("query_spending", params)
      .pipe(Effect.flatMap(Stream.runCollect))
    const [result] = results
    return { isFailure: result?.isFailure, encoded: result?.encodedResult }
  }).pipe(Effect.provide(D1Client.layer({ db: env.DB })), Effect.runPromise)

describe("the query_spending tool", () => {
  it("returns the server's totals for the range, confirmed and net of refunds", async () => {
    await insert("a", 50000, 2, "2026-10-03", "confirmed")
    await insert("b", -10000, 2, "2026-10-20", "confirmed")
    await insert("c", 25000, 3, "2026-10-31", "confirmed")
    await insert("d", 99000, 3, "2026-10-15", "draft")
    await insert("e", 77000, 3, "2026-11-01", "confirmed")

    expect(await callTool({ from: "2026-10-01", to: "2026-10-31", groupBy: "category" })).toEqual({
      isFailure: false,
      encoded: {
        from: "2026-10-01",
        to: "2026-10-31",
        groupBy: "category",
        total: 65000,
        totals: [
          { label: "Dining", categoryId: 2, amount: 40000 },
          { label: "Transport", categoryId: 3, amount: 25000 },
        ],
      },
    })
  })

  it("groups by month when asked", async () => {
    await insert("a", 50000, 2, "2026-10-03", "confirmed")
    await insert("b", 30000, 1, "2026-11-01", "confirmed")

    expect(
      await callTool({ from: "2026-10-01", to: "2026-11-30", groupBy: "month" }),
    ).toMatchObject({
      isFailure: false,
      encoded: {
        total: 80000,
        totals: [
          { label: "2026-10", amount: 50000 },
          { label: "2026-11", amount: 30000 },
        ],
      },
    })
  })

  it("hands a call without both dates back to the model as a failure it can correct", async () => {
    const { isFailure } = await callTool({ from: "2026-10-01", groupBy: "month" })

    expect(isFailure).toBe(true)
  })
})
