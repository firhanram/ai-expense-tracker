import { Effect } from "effect"
import { heldReceiptKeys } from "../expenses/ExpenseStore.ts"
import { ReceiptStore } from "./ReceiptStore.ts"

/**
 * How long an upload may wait for an Expense to hold it. Uploading and
 * sending the Chat message are two requests, so a fresh upload no Draft
 * holds yet is normal; a day-old one is abandoned.
 */
export const orphanAge = 24 * 60 * 60 * 1000

/** D1 binds at most 100 parameters per statement. */
const keysPerQuery = 100

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
    const candidates = yield* receipts.uploadedBefore(new Date(now.getTime() - orphanAge))

    const held = new Set<string>()
    for (let start = 0; start < candidates.length; start += keysPerQuery) {
      const keys = yield* heldReceiptKeys(candidates.slice(start, start + keysPerQuery))
      for (const key of keys) held.add(key)
    }

    const orphans = candidates.filter((key) => !held.has(key))
    yield* receipts.remove(orphans)
    return orphans.length
  })
