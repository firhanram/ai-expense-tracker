import { type ChatMessage, MessageNotFound, RerenderFailed } from "@expense/contract"
import { joinReply, splitReply } from "@expense/ui/server"
import { Effect, Option, Stream } from "effect"
import { LanguageModel, type Prompt } from "effect/ai"
import { toUnreachable } from "./ChatTurn.ts"
import { SystemPrompt } from "./SystemPrompt.ts"

const instruction = [
  "Your reply above could not be drawn: its openui-lang program is not valid.",
  "Rewrite it as one valid openui-lang program in a fenced block.",
  "Use only the ids already in that reply; you have no tools and must not invent one.",
  "Write nothing but the program.",
].join(" ")

const rerenderPrompt = (
  systemPrompt: string,
  message: ChatMessage,
): Array<Prompt.MessageEncoded> => [
  { role: "system", content: systemPrompt },
  { role: "assistant", content: [{ type: "text", text: joinReply(message) }] },
  { role: "user", content: [{ type: "text", text: instruction }] },
]

/** Props that name an Expense or a Category, the ids a rewrite must not invent (ADR-0001). */
const idProps = new Set(["id", "categoryId"])

/**
 * Whether `rewrite` draws: the library's check passes and the root has a
 * component to show. The library is imported here, lazily, so a Chat turn
 * never loads OpenUI or Zod into the Worker; only a re-render does.
 */
const problemsWith = async (rewrite: string, original: string) => {
  const { checkProgram, isElementNode, parseProgram } = await import("@expense/ui")
  const check = checkProgram(rewrite)
  if (check.outcome !== "ok") return check.problems.length > 0 ? check.problems : [check.outcome]
  const ids: Array<unknown> = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isElementNode(node)) return
    for (const [name, value] of Object.entries(node.props)) {
      if (idProps.has(name)) ids.push(value)
      else walk(value)
    }
  }
  const { root } = parseProgram(rewrite)
  walk(root)
  const children = root?.props["children"]
  if (!Array.isArray(children) || !children.some(isElementNode)) return ["nothing to draw"]
  return ids
    .filter((id) => !original.includes(typeof id === "string" ? JSON.stringify(id) : String(id)))
    .map((id) => `invented id: ${String(id)}`)
}

export interface RerenderDeps {
  readonly model: LanguageModel.LanguageModel
  readonly history: {
    readonly find: (id: string) => Effect.Effect<Option.Option<ChatMessage>>
    readonly setUiText: (id: string, uiText: string | null) => Effect.Effect<void>
  }
}

/**
 * Redraws a stored assistant reply whose program cannot be drawn (PLAN,
 * "Failure path"): the model, offered no tools, rewrites the reply's prose
 * and program as a program using only the ids already in it. A rewrite that
 * passes the library's check replaces the message's `uiText`; its `content`
 * stays. The user's message is never sent again, so no Draft is proposed.
 */
export const rerenderMessage = (deps: RerenderDeps, id: string) =>
  Effect.gen(function* () {
    const found = yield* deps.history.find(id)
    if (Option.isNone(found) || found.value.role !== "assistant") {
      return yield* new MessageNotFound({ id })
    }
    const message = found.value

    const systemPrompt = yield* SystemPrompt
    const text = yield* LanguageModel.streamText({
      prompt: rerenderPrompt(systemPrompt, message),
    }).pipe(
      Stream.filter((part) => part.type === "text-delta"),
      Stream.map((part) => part.delta),
      Stream.mkString,
      Effect.provideService(LanguageModel.LanguageModel, deps.model),
      Effect.mapError(toUnreachable),
    )

    const uiText = splitReply(text).uiText
    const problems =
      uiText === null
        ? ["no program"]
        : yield* Effect.promise(() => problemsWith(uiText, joinReply(message)))
    if (uiText === null || problems.length > 0) {
      yield* Effect.logWarning("Re-render rejected", { id, problems })
      return yield* new RerenderFailed({ problems })
    }

    yield* deps.history.setUiText(id, uiText)
    return { ...message, uiText }
  })
