import type { ReceiptKey } from "@expense/contract"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog"
import { X } from "lucide-react"
import { useState } from "react"

/** Same origin, so Access's cookie goes with the `<img>` request (ADR-0011). */
export const receiptUrl = (key: ReceiptKey) => `/api/receipts/${encodeURIComponent(key)}`

/**
 * A Receipt's 56×56 thumbnail. Tapping it opens the photo full-screen;
 * Escape or the × closes it. A photo that will not load (already deleted)
 * leaves the empty tile rather than a broken-image icon.
 */
export const ReceiptPhoto = ({ receiptKey }: { readonly receiptKey: ReceiptKey }) => {
  const [broken, setBroken] = useState(false)
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Open receipt photo"
        className="size-14 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2"
      >
        <img
          src={receiptUrl(receiptKey)}
          alt="Receipt"
          width={56}
          height={56}
          loading="lazy"
          data-broken={broken}
          onError={() => setBroken(true)}
          className="size-full object-cover data-[broken=true]:invisible"
        />
      </DialogTrigger>
      <DialogBackdrop className="fixed inset-0 bg-[rgb(12_10_9/0.9)]" />
      <DialogContent
        initialFocus="content"
        className="fixed inset-0 m-0 grid h-dvh max-h-none w-dvw max-w-none place-items-center bg-transparent p-4 pt-16 outline-none md:p-16"
      >
        <DialogTitle className="sr-only">Receipt</DialogTitle>
        <img
          src={receiptUrl(receiptKey)}
          alt="Receipt"
          className="max-h-[calc(100dvh-5rem)] max-w-full rounded-md object-contain md:max-h-[calc(100dvh-8rem)]"
        />
        <DialogClose
          aria-label="Close"
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-[rgb(255_255_255/0.14)] text-[rgb(250_250_249)] transition-colors duration-(--motion-color) hover:bg-[rgb(255_255_255/0.24)]"
        >
          <X aria-hidden="true" size={20} />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
