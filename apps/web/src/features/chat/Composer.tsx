import type { IsoDate } from "@expense/contract"
import { type InputController, Textarea } from "@ui-sdk/react/textarea"
import { ArrowUp, Paperclip } from "lucide-react"
import { useState } from "react"
import { localToday } from "../../shared/format/localDate.ts"
import { DateChip } from "./DateChip.tsx"

/**
 * Where the user writes. Enter sends, Shift+Enter adds a line, and it never
 * locks: sending while a reply streams queues. The date goes with the
 * message and goes back to Today after each send.
 */
export const Composer = ({
  controller,
  tall,
  onSend,
  onAttachReceipt,
}: {
  readonly controller: InputController
  /** The empty state's composer starts about three lines tall. */
  readonly tall: boolean
  readonly onSend: (message: string, clientDate: IsoDate) => void
  readonly onAttachReceipt: () => void
}) => {
  const today = localToday()
  const [text, setText] = useState("")
  const [date, setDate] = useState<IsoDate | null>(null)
  const message = text.trim()

  const send = () => {
    if (message === "") return
    onSend(message, date ?? today)
    setText("")
    setDate(null)
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-md transition-[border-color,box-shadow] duration-(--motion-color) has-[textarea:focus]:border-ring has-[textarea:focus]:shadow-focus">
      <Textarea
        aria-label="Message"
        placeholder="Log a purchase or ask about your spending…"
        value={text}
        onValueChange={setText}
        controller={controller}
        autoResize
        submitShortcut="enter"
        onSubmit={send}
        rows={1}
        data-tall={tall}
        className="block max-h-[150px] min-h-[46px] w-full resize-none bg-transparent px-1 py-0.5 text-md outline-none placeholder:text-text-muted focus-visible:outline-none data-[tall=true]:min-h-[69px]"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Attach receipt"
          onClick={onAttachReceipt}
          className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-2 text-sm font-medium transition-colors duration-(--motion-color) hover:bg-surface-2 md:px-3"
        >
          <Paperclip aria-hidden="true" size={14} className="text-text-muted" />
          <span className="max-md:hidden">Receipt</span>
        </button>
        <DateChip value={date ?? today} today={today} onChange={setDate} />
        <button
          type="button"
          aria-label="Send"
          disabled={message === ""}
          onClick={send}
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-opacity duration-(--motion-color) disabled:opacity-40"
        >
          <ArrowUp aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  )
}
