import {
  FileInput,
  type FileInputController,
  FileInputDropzone,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
  FileInputTrigger,
} from "@ui-sdk/react/file-input"
import { Paperclip, Receipt, X } from "lucide-react"
import type { ReactNode } from "react"
import { receiptTypes } from "./downscale.ts"

const chip =
  "flex h-8 items-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-(--motion-color)"

/**
 * One pending Receipt for the composer, chosen with the picker, dropped
 * anywhere on the page, or pasted into `pasteTarget`. A new photo replaces
 * the pending one; anything not a JPEG, PNG or WebP goes to `onRefused`.
 */
export const ReceiptInput = ({
  controller,
  value,
  onValueChange,
  onRefused,
  pasteTarget,
  children,
}: {
  readonly controller: FileInputController
  readonly value: ReadonlyArray<File>
  readonly onValueChange: (value: ReadonlyArray<File>) => void
  readonly onRefused: () => void
  readonly pasteTarget: () => HTMLElement | null
  readonly children: ReactNode
}) => (
  <FileInput
    controller={controller}
    accept={[...receiptTypes]}
    value={[...value]}
    onValueChange={(next) => onValueChange(next)}
    onReject={onRefused}
    className="contents"
  >
    {children}
    <FileInputDropzone
      target="document"
      pasteTarget={pasteTarget}
      className="pointer-events-none fixed inset-0 z-50 hidden place-items-center bg-bg/80 p-4 data-dragging:grid"
    >
      <span className="flex items-center gap-2 rounded-xl border border-dashed border-ring bg-surface px-6 py-4 text-md shadow-pop">
        <Receipt aria-hidden="true" size={18} />
        Drop the receipt to attach it
      </span>
    </FileInputDropzone>
  </FileInput>
)

/** The toolbar's `📎 Receipt` chip, icon-only below `md`. */
export const ReceiptButton = () => (
  <FileInputTrigger
    aria-label="Attach receipt"
    className={`${chip} border border-line bg-surface px-2 hover:bg-surface-2 md:px-3`}
  >
    <Paperclip aria-hidden="true" size={14} className="text-text-muted" />
    <span aria-hidden="true" className="max-md:hidden">
      Receipt
    </span>
  </FileInputTrigger>
)

/** The pending Receipt: its file name and an × to remove it. */
export const AttachmentChip = () => (
  <FileInputList aria-label="Attachment" className="contents">
    <FileInputItem className={`${chip} min-w-0 bg-surface-2 pr-1.5 pl-3 outline-offset-2`}>
      {({ file }) => (
        <>
          <Receipt aria-hidden="true" size={14} className="shrink-0" />
          <span className="max-w-[14ch] truncate md:max-w-[24ch]">{file.name}</span>
          <FileInputItemRemove className="grid size-5 place-items-center rounded-full text-text-muted hover:bg-surface hover:text-text">
            <X aria-hidden="true" size={12} />
          </FileInputItemRemove>
        </>
      )}
    </FileInputItem>
  </FileInputList>
)
