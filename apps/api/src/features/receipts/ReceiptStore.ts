import { Context, Effect, Layer, Option } from "effect"

/** A stored Receipt as read back: its bytes and the type it was uploaded as. */
export interface StoredReceipt {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/**
 * Receipt images in R2 (PLAN, "Receipts"). Keys are opaque ids this store
 * makes; `expense.receipt_key` is the only link to an Expense. R2 failing
 * is a defect (500), not something a caller can act on.
 */
export class ReceiptStore extends Context.Service<
  ReceiptStore,
  {
    /** Stores an image and returns its new key. */
    readonly put: (bytes: ArrayBuffer | Uint8Array, contentType: string) => Effect.Effect<string>
    readonly get: (key: string) => Effect.Effect<Option.Option<StoredReceipt>>
    /** Deletes these keys; a key already gone is not an error. */
    readonly remove: (keys: ReadonlyArray<string>) => Effect.Effect<void>
    /** Keys of every object uploaded before `cutoff`, for the orphan sweep. */
    readonly uploadedBefore: (cutoff: Date) => Effect.Effect<ReadonlyArray<string>>
  }
>()("expense/ReceiptStore") {}

const r2 = <A>(what: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new Error(`R2 ${what} failed`, { cause }),
  }).pipe(Effect.orDie)

/** The store over the Worker's `RECEIPTS` binding. */
export const ReceiptStoreLive = (bucket: R2Bucket) =>
  Layer.succeed(ReceiptStore, {
    put: (bytes, contentType) => {
      const key = crypto.randomUUID()
      return r2("put", () => bucket.put(key, bytes, { httpMetadata: { contentType } })).pipe(
        Effect.as(key),
      )
    },

    get: (key) =>
      r2("get", async () => {
        const object = await bucket.get(key)
        if (object === null) return Option.none()
        return Option.some({
          bytes: new Uint8Array(await object.arrayBuffer()),
          contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
        })
      }),

    remove: (keys) =>
      // R2 deletes at most 1,000 keys per call.
      Effect.forEach(
        Array.from({ length: Math.ceil(keys.length / 1000) }, (_, i) =>
          keys.slice(i * 1000, (i + 1) * 1000),
        ),
        (chunk) => r2("delete", () => bucket.delete([...chunk])),
        { discard: true },
      ),

    uploadedBefore: (cutoff) =>
      r2("list", async () => {
        const keys: Array<string> = []
        let cursor: string | undefined
        do {
          // oxlint-disable-next-line no-await-in-loop -- each page names the next.
          const page = await bucket.list(cursor === undefined ? {} : { cursor })
          for (const object of page.objects) {
            if (object.uploaded < cutoff) keys.push(object.key)
          }
          cursor = page.truncated ? page.cursor : undefined
        } while (cursor !== undefined)
        return keys
      }),
  })
