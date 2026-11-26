import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql"
import { ReceiptStore } from "./ReceiptStore.ts"

/**
 * How long an upload may wait for an Expense to hold it. Uploading and
 * sending the Chat message are two requests, so a fresh upload no Draft
 * holds yet is normal; a day-old one is abandoned.
 */
export const orphanAge = 24 * 60 * 60 * 1000

/** D1 binds at most 100 parameters per statement. */
const keysPerQuery = 100

const decodeKeys = Schema.decodeUnknownEffect(
  Schema.Array(Schema.Struct({ receipt_key: Schema.String })),
)

/**
 * Deletes every Receipt uploaded more than `orphanAge` before `now` that no
 * Expense holds (story 16: an upload that never becomes an Expense is
 * deleted). Discarding or deleting an Expense removes its Receipt at once;
 * this catches the rest: uploads whose Chat message never came, a turn
 * that failed before the model wrote anything, and any R2 delete that
 * failed after its row was gone. Runs daily from the Worker's cron trigger
 * (`alchemy.run.ts`). Returns how many it deleted.
 */
export const sweepOrphanReceipts = (now: Date) =>
  Effect.gen(function* () {
    const receipts = yield* ReceiptStore
    const sql = yield* SqlClient.SqlClient
    const candidates = yield* receipts.uploadedBefore(new Date(now.getTime() - orphanAge))

    const held = new Set<string>()
    for (let start = 0; start < candidates.length; start += keysPerQuery) {
      const chunk = candidates.slice(start, start + keysPerQuery)
      const rows = yield* sql`
        SELECT receipt_key FROM expense WHERE receipt_key IN ${sql.in(chunk)}`.pipe(
        Effect.flatMap(decodeKeys),
        Effect.orDie,
      )
      for (const row of rows) held.add(row.receipt_key)
    }

    const orphans = candidates.filter((key) => !held.has(key))
    yield* receipts.remove(orphans)
    return orphans.length
  })
