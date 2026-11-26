import { ApiFailure, ApiSuccess, type ReceiptKey, ReceiptUploaded } from "@expense/contract"
import { Data, Option, Schema } from "effect"
import { downscaleReceipt, UnreadableImage } from "./downscale.ts"

/** Why a Receipt did not upload: `invalid` when the photo is not one the server (or browser) can read. */
export type UploadFailureReason = "invalid" | "unauthorized" | "network" | "failed"

export class ReceiptUploadFailure extends Data.TaggedError("ReceiptUploadFailure")<{
  readonly reason: UploadFailureReason
}> {}

const decodeSuccess = Schema.decodeUnknownOption(ApiSuccess(ReceiptUploaded))
const decodeFailure = Schema.decodeUnknownOption(ApiFailure)

const reasonFor = (code: string): UploadFailureReason =>
  code === "INVALID_RECEIPT" ? "invalid" : code === "UNAUTHORIZED" ? "unauthorized" : "failed"

/** Downscales a photo and stores it, resolving with the key to send as `receiptKey`. */
export type UploadReceipt = (photo: File) => Promise<ReceiptKey>

export interface UploadReceiptOptions {
  readonly baseUrl: string
  /** `apiConnection.fetch`: same origin, so the browser marks it `Sec-Fetch-Site: same-origin`. */
  readonly fetch: typeof globalThis.fetch
}

/** `POST /api/receipts` as multipart (the typed client has no payload schema for it). */
export const createUploadReceipt =
  (options: UploadReceiptOptions): UploadReceipt =>
  async (photo) => {
    const image = await downscaleReceipt(photo).catch((error: unknown) => {
      throw error instanceof UnreadableImage
        ? new ReceiptUploadFailure({ reason: "invalid" })
        : error
    })
    const form = new FormData()
    form.append("file", image, image.name)
    const response = await options
      .fetch(new URL("/api/receipts", options.baseUrl), { method: "POST", body: form })
      .catch(() => {
        throw new ReceiptUploadFailure({ reason: "network" })
      })
    const body: unknown = await response.json().catch(() => null)
    const uploaded = decodeSuccess(body)
    if (response.ok && Option.isSome(uploaded)) return uploaded.value.data.receiptKey
    const reason = Option.match(decodeFailure(body), {
      onNone: () => "failed" as const,
      onSome: (failure) => reasonFor(failure.error.errorCode),
    })
    throw new ReceiptUploadFailure({ reason })
  }
