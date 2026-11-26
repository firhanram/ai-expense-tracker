import type { IsoDate } from "@expense/contract"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useReducer } from "react"
import { useOnline } from "../../shared/shell/useOnline.ts"
import { expensesKey } from "../expenses/useExpenses.ts"
import { SendChatFailure, type SendChatFailureReason } from "./sendChat.ts"

/** What became of a message sent this visit. */
export type Reply =
  | { readonly state: "queued" }
  | { readonly state: "streaming"; readonly text: string }
  | { readonly state: "done"; readonly text: string }
  /** `text` is what streamed before it failed; empty when it failed before the first word. */
  | { readonly state: "failed"; readonly text: string; readonly reason: ReplyFailure }

/** Why a reply failed: the send was refused, or the stream broke after it began (`cut-off`). */
export type ReplyFailure = SendChatFailureReason | "cut-off"

/**
 * A message as the user sent it. `message` may be empty when a Receipt goes
 * alone; the Receipt is still the photo, uploaded when its turn sends.
 */
export interface ChatRequest {
  readonly message: string
  readonly clientDate: IsoDate
  readonly receipt: File | null
}

/** Sends one turn; resolves once the reply starts, like `SendChat`. */
export type SendTurn = (request: ChatRequest) => Promise<AsyncIterable<string>>

/** One message the user sent this visit, and its reply. */
export interface Turn {
  readonly id: string
  readonly request: ChatRequest
  readonly reply: Reply
}

interface State {
  readonly turns: ReadonlyArray<Turn>
  /** Turn ids waiting to send, in order. */
  readonly queue: ReadonlyArray<string>
  /** The turn whose reply is streaming. */
  readonly active: string | null
}

type Action =
  | { readonly type: "send"; readonly id: string; readonly request: ChatRequest }
  | { readonly type: "start"; readonly id: string }
  | { readonly type: "chunk"; readonly id: string; readonly text: string }
  | { readonly type: "done"; readonly id: string }
  | { readonly type: "fail"; readonly id: string; readonly reason: ReplyFailure }
  | { readonly type: "retry"; readonly id: string }

const replyText = (reply: Reply) => (reply.state === "queued" ? "" : reply.text)

const reduce = (state: State, action: Action): State => {
  const update = (change: (turn: Turn) => Reply) => ({
    turns: state.turns.map((turn) =>
      turn.id === action.id ? { ...turn, reply: change(turn) } : turn,
    ),
  })
  switch (action.type) {
    case "send":
      return {
        ...state,
        turns: [
          ...state.turns,
          { id: action.id, request: action.request, reply: { state: "queued" } },
        ],
        queue: [...state.queue, action.id],
      }
    case "start":
      return {
        ...update(() => ({ state: "streaming", text: "" })),
        queue: state.queue.filter((id) => id !== action.id),
        active: action.id,
      }
    case "chunk":
      return {
        ...state,
        ...update((turn) => ({ state: "streaming", text: replyText(turn.reply) + action.text })),
      }
    case "done":
      return {
        ...state,
        ...update((turn) => ({ state: "done", text: replyText(turn.reply) })),
        active: null,
      }
    case "fail":
      return {
        ...state,
        ...update((turn) => ({
          state: "failed",
          text: replyText(turn.reply),
          reason: action.reason,
        })),
        active: null,
      }
    default:
      return {
        ...state,
        ...update(() => ({ state: "queued" })),
        queue: [...state.queue, action.id],
      }
  }
}

let nextId = 0

/**
 * The messages sent this visit and their replies. Sending never waits: a
 * message sent while a reply streams, or while offline, queues and goes once
 * the one before it has finished and the browser is online. Every finished
 * reply refreshes the cached Expenses, which the agent may have changed.
 */
export const useChatSession = (sendChat: SendTurn) => {
  const [state, dispatch] = useReducer(reduce, { turns: [], queue: [], active: null })
  const online = useOnline()
  const queryClient = useQueryClient()

  useEffect(() => {
    const id = state.queue[0]
    const turn = state.turns.find((candidate) => candidate.id === id)
    if (state.active !== null || !online || id === undefined || turn === undefined) return
    dispatch({ type: "start", id })
    const run = async () => {
      let started = false
      try {
        const chunks = await sendChat(turn.request)
        started = true
        for await (const text of chunks) dispatch({ type: "chunk", id, text })
        dispatch({ type: "done", id })
      } catch (error) {
        const reason =
          error instanceof SendChatFailure ? error.reason : started ? "cut-off" : "failed"
        dispatch({ type: "fail", id, reason })
      } finally {
        // The agent's tools may have changed Drafts (update_draft, discard_draft);
        // cards fetch by id, so a refetch is how earlier cards follow.
        void queryClient.invalidateQueries({ queryKey: expensesKey })
      }
    }
    void run()
  }, [state, online, sendChat, queryClient])

  const send = useCallback((request: ChatRequest) => {
    nextId += 1
    dispatch({ type: "send", id: `local-${nextId}`, request })
  }, [])

  const retry = useCallback((id: string) => dispatch({ type: "retry", id }), [])

  return { turns: state.turns, send, retry }
}
