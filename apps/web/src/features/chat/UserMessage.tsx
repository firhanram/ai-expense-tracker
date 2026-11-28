import { Receipt } from "lucide-react"
import { useState } from "react"
import { ReceiptLightbox } from "../receipts/index.ts"
import { receiptOnlyMessage } from "./sendTurn.ts"

/**
 * The Receipt photo at the top of the bubble. Tapping it opens it
 * full-screen. A photo that will not load (deleted with its Expense) shows
 * a plain "Receipt" tile instead of a broken image.
 */
const ReceiptThumbnail = ({ src }: { readonly src: string }) => {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <p className="flex h-14 items-center justify-center gap-1.5 rounded-[10px] bg-surface text-sm text-text-muted">
        <Receipt aria-hidden="true" size={16} className="shrink-0" />
        Receipt
      </p>
    )
  }
  return (
    <ReceiptLightbox
      src={src}
      className="block w-full overflow-hidden rounded-[10px] bg-surface outline-offset-2"
    >
      <img
        src={src}
        alt="Receipt"
        loading="lazy"
        onError={() => setBroken(true)}
        className="aspect-[4/3] w-full object-cover object-top"
      />
    </ReceiptLightbox>
  )
}

/**
 * The user's message: a right-aligned bubble pointing at the composer. A
 * Receipt sent with it sits inside the bubble, above the words, so the
 * photo and what was said about it read as one message. `receipt` is the
 * photo's URL: a stored Receipt's, or the picked file's for a message
 * sent this visit. A Receipt sent with no words carries only the photo.
 */
export const UserMessage = ({
  content,
  receipt = null,
}: {
  readonly content: string
  readonly receipt?: string | null
}) => {
  const text = receipt !== null && content === receiptOnlyMessage ? "" : content
  if (receipt === null) {
    return (
      <article aria-label="You" className="animate-message-in flex flex-col items-end">
        <p className="max-w-[85%] rounded-xl rounded-br-[4px] bg-surface-2 px-4 py-2.5 text-md whitespace-pre-wrap break-words">
          {text}
        </p>
      </article>
    )
  }
  return (
    <article aria-label="You" className="animate-message-in flex flex-col items-end">
      <div className="flex w-52 max-w-[85%] flex-col gap-1 rounded-xl rounded-br-[4px] bg-surface-2 p-1">
        <ReceiptThumbnail src={receipt} />
        {text === "" ? null : (
          <p className="px-3 pt-1 pb-1.5 text-md whitespace-pre-wrap break-words">{text}</p>
        )}
      </div>
    </article>
  )
}
