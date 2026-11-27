import { Fragment, type ReactNode } from "react"
import { GeneratedUi } from "../generated-ui/index.ts"
import { ReplySkeleton, ThinkingIndicator } from "./PendingReply.tsx"
import { replyPhase } from "./replyPhase.ts"

/** An assistant reply as stored, or as split from the stream so far (`splitReply`). */
export interface AssistantReply {
  /** Prose. */
  readonly content: string
  /** Raw OpenUI Lang, or null when the reply wrote none. */
  readonly uiText: string | null
}

const emphasis = /(\*\*[^*]+\*\*|\*[^*]+\*)/g

// Paragraphs and emphasis runs are cut from prose and have no id; text can repeat, and
// a stream only appends, so position plus text is the stable key.

/** Paragraphs and emphasis, nothing more (DESIGN, "What this design does not do"). */
const inline = (text: string): ReactNode =>
  text.split(emphasis).map((part, index) => {
    const key = `${index}:${part}`
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={key}>{part}</Fragment>
  })

const paragraphs = (content: string) =>
  content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

/**
 * An assistant turn: prose with no bubble, a caret while prose streams, and
 * the reply's program drawn below the prose. Until there is prose, or while
 * a program streams, a thinking indicator says what the reply is doing, and
 * the program's block waits as a placeholder of its shape, drawn once the
 * stream ends. `onRetry` is offered when that program cannot be drawn.
 */
export const AssistantMessage = ({
  reply,
  streaming,
  withReceipt = false,
  onRetry,
}: {
  readonly reply: AssistantReply
  readonly streaming: boolean
  /** The user's turn carried a Receipt, so the first phase reads it. */
  readonly withReceipt?: boolean
  readonly onRetry?: (() => void) | undefined
}) => {
  const prose = paragraphs(reply.content)
  const empty = prose.length === 0 && reply.uiText === null
  const phase = streaming ? replyPhase(reply, withReceipt) : null

  return (
    <article
      aria-label="Assistant"
      aria-busy={streaming}
      className="animate-message-in flex flex-col gap-2 text-md"
    >
      {prose.map((paragraph, index) => (
        <p key={`${index}:${paragraph.slice(0, 16)}`} className="whitespace-pre-wrap">
          {inline(paragraph)}
          {phase === null && streaming && index === prose.length - 1 ? <Caret /> : null}
        </p>
      ))}
      {phase === null ? null : (
        <div className={prose.length === 0 ? "flex flex-col gap-3" : "mt-3 flex flex-col gap-3"}>
          <ThinkingIndicator label={phase.label} />
          {phase.shape === null ? null : <ReplySkeleton shape={phase.shape} />}
        </div>
      )}
      {reply.uiText === null || streaming ? null : (
        <div className={prose.length === 0 ? "animate-message-in" : "animate-message-in mt-3"}>
          <GeneratedUi program={reply.uiText} streaming={false} onRetry={onRetry} />
        </div>
      )}
      {!streaming && empty ? <p className="text-sm text-text-muted">No reply.</p> : null}
    </article>
  )
}

const Caret = () => (
  <span
    aria-hidden="true"
    className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[0.2em] bg-text"
  />
)
