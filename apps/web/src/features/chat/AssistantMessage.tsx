import { Fragment, type ReactNode } from "react"

/** An assistant reply as stored, or as split from the stream so far (`splitReply`). */
export interface AssistantReply {
  /** Prose. */
  readonly content: string
  /** Raw OpenUI Lang, or null when the reply wrote none. */
  readonly uiText: string | null
}

const emphasis = /(\*\*[^*]+\*\*|\*[^*]+\*)/g

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
 * An assistant turn: prose with no bubble, and a caret while it streams.
 * The one place a reply is drawn, so the generated UI (W11) renders
 * `reply.uiText` here, below the prose.
 */
export const AssistantMessage = ({
  reply,
  streaming,
}: {
  readonly reply: AssistantReply
  readonly streaming: boolean
}) => {
  const prose = paragraphs(reply.content)
  const empty = prose.length === 0 && reply.uiText === null

  return (
    <article
      aria-label="Assistant"
      aria-busy={streaming}
      className="animate-message-in flex flex-col gap-2 text-md"
    >
      {prose.map((paragraph, index) => (
        <p key={`${index}:${paragraph.slice(0, 16)}`} className="whitespace-pre-wrap">
          {inline(paragraph)}
          {streaming && index === prose.length - 1 ? <Caret /> : null}
        </p>
      ))}
      {streaming && prose.length === 0 ? (
        <p>
          <Caret />
        </p>
      ) : null}
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
