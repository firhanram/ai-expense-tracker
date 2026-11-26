import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { ReceiptKey } from "../expenses/Expense.ts"

/** The image types a Receipt may be: what the model reads and a browser shows. */
export const ReceiptContentTypes = ["image/jpeg", "image/png", "image/webp"] as const

/**
 * The largest Receipt upload, in bytes. The client downscales first (PLAN,
 * "Receipts"), so a real upload is far smaller; this only stops an unscaled
 * photo or a stray file from reaching R2 and the model.
 */
export const maxReceiptBytes = 5 * 1024 * 1024

/** `POST /receipts`: the key to send as `receiptKey` with the Chat message. */
export const ReceiptUploaded = Schema.Struct({ receiptKey: ReceiptKey })
export type ReceiptUploaded = typeof ReceiptUploaded.Type

/** The upload is not one image of an accepted type and size, sent as the `file` field. */
export class InvalidReceipt extends Schema.TaggedError<InvalidReceipt>()(
  "InvalidReceipt",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

/** No stored Receipt has this key: never uploaded, or already deleted. */
export class ReceiptNotFound extends Schema.TaggedError<ReceiptNotFound>()(
  "ReceiptNotFound",
  { receiptKey: ReceiptKey },
  { httpApiStatus: 404 },
) {}

export class ReceiptsGroup extends HttpApiGroup.make("receipts").add(
  /**
   * Multipart, with the image as the `file` field. Read from the web
   * `Request` rather than a multipart payload schema: buffered multipart
   * needs a temp directory, which a Worker does not have.
   */
  HttpApiEndpoint.post("upload", "/receipts", {
    success: ReceiptUploaded.pipe(HttpApiSchema.status(201)),
    error: InvalidReceipt,
  }),
  /** The image itself, behind the bearer token like every route; never a presigned URL. */
  HttpApiEndpoint.get("get", "/receipts/:key", {
    params: { key: ReceiptKey },
    success: HttpApiSchema.StreamUint8Array({ contentType: [...ReceiptContentTypes] }),
    error: ReceiptNotFound,
  }),
) {}
