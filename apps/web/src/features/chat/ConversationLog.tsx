import type { ChatMessage } from "@expense/contract"
import { splitReply } from "@expense/ui/server"
import { useEffect, useLayoutEffect, useRef } from "react"
import { AssistantMessage } from "./AssistantMessage.tsx"
import { SystemLine } from "./SystemLine.tsx"
import type { ReplyFailure, Turn } from "./useChatSession.ts"
import { UserMessage } from "./UserMessage.tsx"

const nearBottomPx = 96

const distanceFromBottom = () =>
  document.documentElement.scrollHeight - window.scrollY - window.innerHeight

const TurnView = ({ turn, onRetry }: { readonly turn: Turn; readonly onRetry: () => void }) => {
  const { reply } = turn
  return (
    <>
      <UserMessage content={turn.request.message} />
      {reply.state === "streaming" || reply.state === "done" ? (
        <AssistantMessage reply={splitReply(reply.text)} streaming={reply.state === "streaming"} />
      ) : null}
      {reply.state === "failed" ? (
        <>
          {reply.text === "" ? null : (
            <AssistantMessage reply={splitReply(reply.text)} streaming={false} />
          )}
          <SystemLine failure={reply.reason} onRetry={onRetry} />
        </>
      ) : null}
    </>
  )
}

/**
 * The conversation: the stored Chat, then this visit's turns. It keeps the
 * newest message in view while the reader is at the bottom, and loads older
 * pages when the reader scrolls to the top without moving what they read.
 */
export const ConversationLog = ({
  history,
  historyFailure,
  turns,
  hasOlder,
  onLoadOlder,
  onRetryHistory,
  onRetry,
}: {
  readonly history: ReadonlyArray<ChatMessage>
  readonly historyFailure: ReplyFailure | null
  readonly turns: ReadonlyArray<Turn>
  readonly hasOlder: boolean
  readonly onLoadOlder: () => void
  readonly onRetryHistory: () => void
  readonly onRetry: (turnId: string) => void
}) => {
  const top = useRef<HTMLDivElement>(null)
  const stuckToBottom = useRef(true)
  const keptFromBottom = useRef<number | null>(null)

  useEffect(() => {
    const onScroll = () => {
      stuckToBottom.current = distanceFromBottom() < nearBottomPx
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const sentinel = top.current
    const observer =
      sentinel === null || !hasOlder || typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            if (entry?.isIntersecting !== true) return
            keptFromBottom.current = distanceFromBottom()
            onLoadOlder()
          })
    if (sentinel !== null) observer?.observe(sentinel)
    return () => observer?.disconnect()
  }, [hasOlder, onLoadOlder])

  const oldestId = history[0]?.id
  useLayoutEffect(() => {
    if (keptFromBottom.current === null) return
    window.scrollTo({
      top: document.documentElement.scrollHeight - window.innerHeight - keptFromBottom.current,
    })
    keptFromBottom.current = null
  }, [oldestId])

  const last = turns.at(-1)
  const lastLength =
    last === undefined || last.reply.state === "queued" ? 0 : last.reply.text.length
  useLayoutEffect(() => {
    if (stuckToBottom.current) window.scrollTo({ top: document.documentElement.scrollHeight })
  }, [history.length, turns.length, last?.reply.state, lastLength])

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      className="flex flex-col gap-5 pt-8 pb-6"
    >
      <div ref={top} aria-hidden="true" className="h-px" />
      {historyFailure === null ? null : (
        <SystemLine failure={historyFailure} onRetry={onRetryHistory} />
      )}
      {history.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} content={message.content} />
        ) : (
          <AssistantMessage key={message.id} reply={message} streaming={false} />
        ),
      )}
      {turns.map((turn) => (
        <TurnView key={turn.id} turn={turn} onRetry={() => onRetry(turn.id)} />
      ))}
    </div>
  )
}
