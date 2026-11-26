import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext,
} from "cloudflare:test"
import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import worker from "../../index.ts"
import { callApi } from "../../testing/callWorker.ts"
import { jpeg, uploadReceipt } from "../../testing/receipts.ts"

const hour = 60 * 60 * 1000

/** Fires the Worker's cron trigger as if it ran at `scheduledTime`. */
const runSweep = async (scheduledTime: number) => {
  const ctx = createExecutionContext()
  worker.scheduled(createScheduledController({ scheduledTime, cron: "0 3 * * *" }), env, ctx)
  await waitOnExecutionContext(ctx)
}

const upload = async () => (await uploadReceipt(jpeg)).receiptKey!

const isStored = async (key: string) => (await callApi(`/api/receipts/${key}`)).status === 200

const holdIn = (key: string, status: "draft" | "confirmed") =>
  env.DB.prepare(
    `INSERT INTO expense (id, amount, category_id, occurred_at, created_at, status, receipt_key)
     VALUES (?, 10000, 1, '2026-11-25', '2026-11-25T00:00:00.000Z', ?, ?)`,
  )
    .bind(crypto.randomUUID(), status, key)
    .run()

describe("the orphan Receipt sweep", () => {
  it("deletes a day-old upload no Expense holds, and keeps those a Draft or Expense holds", async () => {
    const orphan = await upload()
    const drafted = await upload()
    const confirmed = await upload()
    await holdIn(drafted, "draft")
    await holdIn(confirmed, "confirmed")

    await runSweep(Date.now() + 25 * hour)

    expect(await isStored(orphan)).toBe(false)
    expect(await isStored(drafted)).toBe(true)
    expect(await isStored(confirmed)).toBe(true)
  })

  it("leaves a fresh upload, which its Chat message may still be on the way for", async () => {
    const fresh = await upload()

    await runSweep(Date.now() + 1 * hour)

    expect(await isStored(fresh)).toBe(true)
  })
})
