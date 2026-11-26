import {
  Api,
  InvalidReceipt,
  maxReceiptBytes,
  ReceiptContentTypes,
  ReceiptNotFound,
} from "@expense/contract"
import { Effect, Option } from "effect"
import { HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { ReceiptStore } from "./ReceiptStore.ts"

/** Room for the multipart framing around the image itself. */
const framingBytes = 64 * 1024

const isAccepted = (type: string): boolean =>
  ReceiptContentTypes.some((accepted) => accepted === type)

const invalid = (message: string) => Effect.fail(new InvalidReceipt({ message }))

/** The `file` field of a multipart body, or why there is no usable one. */
const readUpload = (request: Request) =>
  Effect.gen(function* () {
    // Refuse an oversized body before buffering it.
    const length = Number(request.headers.get("content-length") ?? 0)
    if (length > maxReceiptBytes + framingBytes) {
      return yield* invalid(`A Receipt may be at most ${maxReceiptBytes} bytes.`)
    }
    const form = yield* Effect.tryPromise({
      try: () => request.formData(),
      catch: () => new InvalidReceipt({ message: "Expected a multipart form with a file field." }),
    })
    const file = form.get("file")
    if (!(file instanceof File)) return yield* invalid("Expected the image as the file field.")
    if (!isAccepted(file.type)) {
      return yield* invalid(`A Receipt must be one of ${ReceiptContentTypes.join(", ")}.`)
    }
    if (file.size === 0) return yield* invalid("The Receipt is empty.")
    if (file.size > maxReceiptBytes) {
      return yield* invalid(`A Receipt may be at most ${maxReceiptBytes} bytes.`)
    }
    return file
  })

/** `POST /api/receipts` stores an image in R2; `GET /api/receipts/:key` serves it back. */
export const ReceiptsLive = HttpApiBuilder.group(Api, "receipts", (handlers) =>
  Effect.gen(function* () {
    const receipts = yield* ReceiptStore
    return handlers
      .handleRaw("upload", ({ request }) =>
        Effect.gen(function* () {
          // A Worker's request is always a web `Request`.
          if (!(request.source instanceof Request)) return yield* Effect.die("not a web Request")
          const file = yield* readUpload(request.source)
          const bytes = yield* Effect.promise(() => file.arrayBuffer())
          const receiptKey = yield* receipts.put(bytes, file.type)
          return { receiptKey }
        }),
      )
      .handleRaw("get", ({ params }) =>
        receipts.get(params.key).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new ReceiptNotFound({ receiptKey: params.key })),
              onSome: (receipt) =>
                Effect.succeed(
                  HttpServerResponse.uint8Array(receipt.bytes, {
                    contentType: receipt.contentType,
                    // A key never names other bytes, but the image is the user's: no shared caches.
                    headers: { "cache-control": "private, max-age=31536000, immutable" },
                  }),
                ),
            }),
          ),
        ),
      )
  }),
)
