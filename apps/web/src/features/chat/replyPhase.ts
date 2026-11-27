import type { AssistantReply } from "./AssistantMessage.tsx"

/** The shape of the block a streaming program will draw, for its placeholder. */
export type PendingShape = "draft" | "chart" | "list"

/**
 * What a reply is doing while it streams, as far as the stream has shown.
 * `null` while prose is arriving: the text itself is the progress.
 */
export interface ReplyPhase {
  readonly label: string
  readonly shape: PendingShape | null
}

const shapes: ReadonlyArray<readonly [RegExp, PendingShape, string]> = [
  [/\bDraftExpenseCard\s*\(/, "draft", "Drafting your expense"],
  [/\bSpendingChart\s*\(/, "chart", "Building the chart"],
  [/\b(?:ExpenseList|ExpenseCard)\s*\(/, "list", "Pulling up your expenses"],
]

/**
 * The phase of a streaming reply, read from what has streamed so far and
 * never from a timer: a phase shows only once the stream proves it.
 */
export const replyPhase = (reply: AssistantReply, withReceipt: boolean): ReplyPhase | null => {
  if (reply.uiText !== null) {
    const known = shapes.find(([pattern]) => pattern.test(reply.uiText ?? ""))
    return known === undefined
      ? { label: "Preparing the answer", shape: null }
      : { label: known[2], shape: known[1] }
  }
  if (reply.content.trim() !== "") return null
  return { label: withReceipt ? "Reading your receipt" : "Reading your message", shape: null }
}
