import { callApi } from "./callWorker.ts"

/** The first bytes of a JPEG: enough to be stored and served, not a real photo. */
export const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

/** A multipart body with `bytes` as the `file` field, as the SPA sends it. */
export const receiptForm = (bytes: Uint8Array, type = "image/jpeg", field = "file") => {
  const form = new FormData()
  form.append(field, new File([bytes], "receipt", { type }))
  return form
}

/**
 * `POST /api/receipts` with the bearer token. `receiptKey` is undefined when
 * it was refused; `body` is the envelope either way.
 */
export const uploadReceipt = async (bytes: Uint8Array, type = "image/jpeg") => {
  const response = await callApi("/api/receipts", {
    method: "POST",
    body: receiptForm(bytes, type),
  })
  const body: { data?: { receiptKey?: string }; error?: unknown } = await response.json()
  return { status: response.status, receiptKey: body.data?.receiptKey, body }
}
