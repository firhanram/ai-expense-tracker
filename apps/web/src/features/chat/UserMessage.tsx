import { Receipt } from "lucide-react"

/**
 * The user's message: a right-aligned bubble pointing at the composer. A
 * Receipt sent with it this visit shows as its file name, as in the composer.
 */
export const UserMessage = ({
  content,
  attachment = null,
}: {
  readonly content: string
  readonly attachment?: string | null
}) => (
  <article aria-label="You" className="animate-message-in flex flex-col items-end gap-1.5">
    {attachment === null ? null : (
      <p className="flex max-w-[85%] items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium">
        <Receipt aria-hidden="true" size={14} className="shrink-0" />
        <span className="sr-only">Receipt: </span>
        <span className="truncate">{attachment}</span>
      </p>
    )}
    {content === "" ? null : (
      <p className="max-w-[85%] rounded-xl rounded-br-[4px] bg-surface-2 px-4 py-2.5 text-md whitespace-pre-wrap break-words">
        {content}
      </p>
    )}
  </article>
)
