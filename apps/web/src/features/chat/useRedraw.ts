import type { ChatMessage } from "@expense/contract"
import { useCallback, useState } from "react"
import { api } from "../../shared/api/api.ts"
import type { AssistantReply } from "./AssistantMessage.tsx"

type Redraw =
  | { readonly state: "pending" | "failed" }
  | { readonly state: "done"; readonly message: ChatMessage }

/**
 * Redraws assistant replies whose program cannot be drawn: Retry on
 * "Showing text only" (PLAN, "Failure path"). The server rewrites the stored
 * program without sending the user's message again; the rewrite replaces the
 * reply in place. Each message gets one try, whatever its outcome.
 */
export const useRedraw = () => {
  const [redraws, setRedraws] = useState<ReadonlyMap<string, Redraw>>(new Map())

  const settle = useCallback((id: string, redraw: Redraw) => {
    setRedraws((current) => new Map(current).set(id, redraw))
  }, [])

  const redraw = useCallback(
    (id: string) => {
      settle(id, { state: "pending" })
      api((client) => client.chat.rerender({ params: { messageId: id } })).then(
        (message) => settle(id, { state: "done", message }),
        () => settle(id, { state: "failed" }),
      )
    },
    [settle],
  )

  /** The reply to show for message `id`: its redraw once that is in, else `reply`. */
  const replyFor = useCallback(
    (id: string | null, reply: AssistantReply): AssistantReply => {
      const known = id === null ? undefined : redraws.get(id)
      return known?.state === "done" ? known.message : reply
    },
    [redraws],
  )

  /** Retry for message `id`, or undefined once it has had its one try. */
  const retryFor = useCallback(
    (id: string | null) => (id === null || redraws.has(id) ? undefined : () => redraw(id)),
    [redraws, redraw],
  )

  return { replyFor, retryFor }
}
