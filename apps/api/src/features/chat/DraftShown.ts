import type { Tool } from "effect/ai"
import type { AgentStep } from "./AgentLoop.ts"

const cardId = /DraftExpenseCard\(\s*"([^"]+)"/g

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
    for (const part of step.parts) {
      if (part.type === "text-delta") text += part.delta
      if (part.type === "tool-result" && part.name === "propose_expense" && !part.isFailure) {
        const { result } = part
        if (typeof result === "object" && result !== null && "id" in result) {
          proposed.add(String(result.id))
        }
      }
    }
    if (proposed.size === 0) return false
    const shown = new Set(Array.from(text.matchAll(cardId), (match) => match[1]))
    return [...proposed].every((id) => shown.has(id))
  }
}
