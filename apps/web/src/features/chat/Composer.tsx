import type { IsoDate } from "@expense/contract"
import type { FileInputController } from "@ui-sdk/react/file-input"
import { type InputController, Textarea } from "@ui-sdk/react/textarea"
import { ArrowUp, CircleAlert } from "lucide-react"
import { useRef, useState } from "react"
import { localToday } from "../../shared/format/localDate.ts"
import { AttachmentChip, ReceiptButton, ReceiptInput } from "../receipts/ReceiptAttachment.tsx"
import { DateChip } from "./DateChip.tsx"

/**
 * Where the user writes. Enter sends, Shift+Enter adds a line, and it never
 * locks: sending while a reply streams queues. The date goes with the
 * message and goes back to Today after each send. A pending Receipt goes
 * with the next send too, which may have no words.
 */
export const Composer = ({
  controller,
  tall,
  receipts,
  onSend,
}: {
  readonly controller: InputController
  /** The empty state's composer starts about three lines tall. */
  readonly tall: boolean
  /** Opens the picker from elsewhere, like the "Scan a receipt" suggestion. */
  readonly receipts: FileInputController
  readonly onSend: (message: string, clientDate: IsoDate, receipt: File | null) => void
}) => {
  const today = localToday()
  const [text, setText] = useState("")
  const [date, setDate] = useState<IsoDate | null>(null)
  const [files, setFiles] = useState<ReadonlyArray<File>>([])
  const [refused, setRefused] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const message = text.trim()
  const receipt = files[0] ?? null

  const send = () => {
    if (message === "" && receipt === null) return
    onSend(message, date ?? today, receipt)
    setText("")
    setDate(null)
    setFiles([])
    setRefused(false)
  }

  return (
    <ReceiptInput
      controller={receipts}
      value={files}
      onValueChange={(next) => {
        setFiles(next)
        setRefused(false)
      }}
      onRefused={() => setRefused(true)}
      pasteTarget={() => textarea.current}
    >
      {refused ? (
        <p role="alert" className="mb-2 flex items-center gap-2 px-1 text-sm text-danger">
          <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
          Attach a JPEG, PNG or WebP photo.
        </p>
      ) : null}
      <div className="rounded-xl border border-line bg-surface p-3 shadow-md transition-[border-color,box-shadow] duration-(--motion-color) has-[textarea:focus]:border-ring has-[textarea:focus]:shadow-focus">
        <Textarea
          ref={textarea}
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
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <ReceiptButton />
          <AttachmentChip />
          <DateChip value={date ?? today} today={today} onChange={setDate} />
          <button
            type="button"
            aria-label="Send"
            disabled={message === "" && receipt === null}
            onClick={send}
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-opacity duration-(--motion-color) disabled:opacity-40"
          >
            <ArrowUp aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </ReceiptInput>
  )
}
