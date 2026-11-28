import type { Tool } from "effect/ai"
import type { AgentStep } from "./AgentLoop.ts"

const draftCardId = /DraftExpenseCard\(\s*"([^"]+)"/g
const anyCardId = /(?:Draft)?ExpenseCard\(\s*"([^"]+)"/g
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** The Expense ids a program shows, as `DraftExpenseCard` or `ExpenseCard`, in order, once each. */
export const cardIds = (text: string): Array<string> => [
  ...new Set(Array.from(text.matchAll(anyCardId), (match) => match[1]!)),
]

const stepText = <Tools extends Record<string, Tool.Any>>(step: AgentStep<Tools>) =>
  step.parts.map((part) => (part.type === "text-delta" ? part.delta : "")).join("")

/**
 * The turn's stop condition (PLAN, "The chat turn"): once every Draft the
 * model proposed this turn has been rendered as a `DraftExpenseCard`, the
 * turn is done, whatever else the model asks for. A Draft proposed but not
 * yet shown keeps the loop going so the model can render it.
 *
 * Stateful across one turn's steps, so make one per turn. The text is
 * scanned, not parsed, to keep OpenUI out of the Worker.
 */
export const draftsShown = () => {
  const proposed = new Set<string>()
  let text = ""
  return <Tools extends Record<string, Tool.Any>>(step: AgentStep<Tools>): boolean => {
    text += stepText(step)
    for (const part of step.parts) {
      if (part.type === "tool-result" && part.name === "propose_expense" && !part.isFailure) {
        const { result } = part
        if (typeof result === "object" && result !== null && "id" in result) {
          proposed.add(String(result.id))
        }
      }
    }
    if (proposed.size === 0) return false
    const shown = new Set(Array.from(text.matchAll(draftCardId), (match) => match[1]))
    return [...proposed].every((id) => shown.has(id))
  }
}

/**
 * The turn's guard against invented ids: a card whose id no tool returned
 * this turn and no earlier reply showed names no Expense. Models do write
 * one, a plausible UUID in place of calling `propose_expense`, and the user
 * then sees a dead card and no Draft. This returns a correction for the
 * agent loop's `correct`, which sends the model back to call the tool.
 *
 * Stateful across one turn's steps, so make one per turn. `known` is the ids
 * earlier replies in the prompt showed; every id in a tool result joins it.
 */
export const inventedCards = (known: Iterable<string>) => {
  const ids = new Set(known)
  return <Tools extends Record<string, Tool.Any>>(step: AgentStep<Tools>): string | undefined => {
    for (const part of step.parts) {
      if (part.type === "tool-result" && !part.isFailure) {
        for (const match of JSON.stringify(part.result ?? null).matchAll(uuid)) ids.add(match[0])
      }
    }
    const invented = cardIds(stepText(step)).filter((id) => !ids.has(id))
    if (invented.length === 0) return undefined
    return [
      `Your reply shows ${invented.map((id) => `"${id}"`).join(", ")}, but no tool returned that id, so no such Expense exists and its card cannot be drawn.`,
      "Never invent an id. Call propose_expense for each Expense you meant (or get_expense for one you know),",
      "then write the program again, complete with root, using only ids the tools return. Do not repeat the prose you already wrote.",
    ].join(" ")
  }
}
