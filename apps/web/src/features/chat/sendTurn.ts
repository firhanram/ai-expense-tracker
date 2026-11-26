import type { ReceiptKey } from "@expense/contract"
import { ReceiptUploadFailure, type UploadReceipt } from "../receipts/uploadReceipt.ts"
import { type SendChat, SendChatFailure, type SendChatFailureReason } from "./sendChat.ts"
import type { SendTurn } from "./useChatSession.ts"

/** What a Receipt sent with no words says to the model; the contract needs a message. */
export const receiptOnlyMessage = "Here's a receipt."

const reasonFor = (error: unknown): SendChatFailureReason => {
  if (!(error instanceof ReceiptUploadFailure)) return "failed"
  return error.reason === "invalid" ? "receipt-invalid" : error.reason
}

/**
 * A turn: its Receipt, if any, uploaded first, then the message with the
 * Receipt's key. A Receipt uploads once, so a retried turn reuses its key.
 */
export const createSendTurn = (sendChat: SendChat, uploadReceipt: UploadReceipt): SendTurn => {
  const keys = new WeakMap<File, Promise<ReceiptKey>>()
  const keyFor = (photo: File) => {
    const known = keys.get(photo)
    if (known !== undefined) return known
    const key = uploadReceipt(photo)
    keys.set(photo, key)
    key.catch(() => keys.delete(photo))
    return key
  }

  return async ({ message, clientDate, receipt }) => {
    if (receipt === null) return sendChat({ message, clientDate })
    const receiptKey = await keyFor(receipt).catch((error: unknown) => {
      throw new SendChatFailure({ reason: reasonFor(error) })
    })
    return sendChat({
      message: message === "" ? receiptOnlyMessage : message,
      clientDate,
      receiptKey,
    })
  }
}
