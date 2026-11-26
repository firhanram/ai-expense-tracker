import { maxReceiptBytes } from "@expense/contract"
import { describe, expect, it } from "vitest"
import { callApi, callWorker } from "../../testing/callWorker.ts"
import { jpeg, receiptForm, uploadReceipt } from "../../testing/receipts.ts"
import { anError, readError } from "../../testing/envelope.ts"

describe("POST /api/receipts and GET /api/receipts/:key", () => {
  it("stores an uploaded image and serves the same bytes back", async () => {
    const { status, receiptKey } = await uploadReceipt(jpeg)

    expect(status).toBe(201)
    const served = await callApi(`/api/receipts/${receiptKey}`)
    expect(served.status).toBe(200)
    expect(served.headers.get("content-type")).toBe("image/jpeg")
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(jpeg)
  })

  it("gives each upload its own key", async () => {
    const first = await uploadReceipt(jpeg)
    const second = await uploadReceipt(jpeg)

    expect(first.receiptKey).not.toEqual(second.receiptKey)
  })

  it("requires the bearer token to upload and to serve", async () => {
    const { receiptKey } = await uploadReceipt(jpeg)

    const upload = await callWorker("/api/receipts", { method: "POST", body: receiptForm(jpeg) })
    const serve = await callWorker(`/api/receipts/${receiptKey}`)

    expect(upload.status).toBe(401)
    expect(serve.status).toBe(401)
  })

  it("refuses a file that is not an accepted image type", async () => {
    const { status, body } = await uploadReceipt(jpeg, "application/pdf")

    expect(status).toBe(400)
    expect(body).toEqual({ success: false, error: anError("INVALID_RECEIPT") })
  })

  it("refuses an image over the size cap", async () => {
    const { status, body } = await uploadReceipt(new Uint8Array(maxReceiptBytes + 1))

    expect(status).toBe(400)
    expect(body).toEqual({ success: false, error: anError("INVALID_RECEIPT") })
  })

  it("refuses a form without the file field", async () => {
    const response = await callApi("/api/receipts", {
      method: "POST",
      body: receiptForm(jpeg, "image/jpeg", "photo"),
    })

    expect(response.status).toBe(400)
  })

  it("serves 404 ReceiptNotFound for a key nothing was stored under", async () => {
    const response = await callApi("/api/receipts/no-such-receipt")

    expect(response.status).toBe(404)
    expect(await readError(response)).toEqual(
      anError("RECEIPT_NOT_FOUND", { receiptKey: "no-such-receipt" }),
    )
  })
})
