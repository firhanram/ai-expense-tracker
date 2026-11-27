import { env } from "cloudflare:workers"
import { ChatHistoryPage, ChatMessage } from "@expense/contract"
import { type Layer, Schema } from "effect"
import type { LanguageModel, Prompt } from "effect/ai"
import { beforeEach, describe, expect, it } from "vitest"
import { callApiWithModel, sendChat } from "../../testing/callWithModel.ts"
import { anError, readData, readError } from "../../testing/envelope.ts"
import {
  makeFakeLanguageModel,
  scriptedLanguageModel,
  textReply,
  unreachable,
  type FakeReply,
} from "../../testing/FakeLanguageModel.ts"

const clientDate = "2026-11-25"

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM chat_message").run()
})

/** A reply whose program references `d`, which it never defines: it cannot be drawn. */
const brokenReply =
  'Here it is.\n```openui-lang\nroot = Stack([c, d])\nc = ExpenseCard("exp_1")\n```'
const fixedProgram = '```openui-lang\nroot = Stack([c])\nc = ExpenseCard("exp_1")\n```'

const history = async (model: Layer.Layer<LanguageModel.LanguageModel>) => {
  const response = await callApiWithModel(model, "/api/chat")
  return Schema.decodeUnknownSync(ChatHistoryPage)(await readData(response.body)).messages
}

const rerender = (model: Layer.Layer<LanguageModel.LanguageModel>, id: string) =>
  callApiWithModel(model, `/api/chat/${id}/rerender`, { method: "POST" })

/** A Chat with one turn whose reply is `brokenReply`, then `rerenderReply` for the re-render call. */
const chatWithBrokenReply = async (rerenderReply: FakeReply | (() => FakeReply)) => {
  const model = makeFakeLanguageModel((call) => {
    if (call === 0) return textReply(brokenReply)
    return typeof rerenderReply === "function" ? rerenderReply() : rerenderReply
  })
  await sendChat(model.layer, { message: "show exp_1", clientDate })
  const [reply] = await history(model.layer)
  return { model, reply: reply! }
}

const promptText = (prompt: Prompt.Prompt) =>
  prompt.content
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => ("text" in part ? part.text : "")).join(""),
    )
    .join("\n")

describe("POST /api/chat/:messageId/rerender", () => {
  it("rewrites the stored program in place, without tools or a new message", async () => {
    const { model, reply } = await chatWithBrokenReply(textReply(fixedProgram))

    const response = await rerender(model.layer, reply.id)

    expect(response.status).toBe(200)
    const updated = Schema.decodeUnknownSync(ChatMessage)(await readData(response.body))
    expect(updated).toEqual({
      ...reply,
      uiText: 'root = Stack([c])\nc = ExpenseCard("exp_1")',
    })
    expect(model.calls[1]!.toolNames).toEqual([])
    expect(promptText(model.calls[1]!.prompt)).toContain("root = Stack([c, d])")
    const messages = await history(model.layer)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual(updated)
  })

  it("keeps the row when the rewrite still does not draw", async () => {
    const { model, reply } = await chatWithBrokenReply(
      textReply("```openui-lang\nroot = Stack([e])\n```"),
    )

    const response = await rerender(model.layer, reply.id)

    expect(response.status).toBe(502)
    expect((await readError(response.body)).errorCode).toBe("RERENDER_FAILED")
    expect((await history(model.layer))[0]).toEqual(reply)
  })

  it("keeps the row when the rewrite names an id the reply did not have", async () => {
    const { model, reply } = await chatWithBrokenReply(
      textReply('```openui-lang\nroot = Stack([c])\nc = ExpenseCard("exp_2")\n```'),
    )

    const response = await rerender(model.layer, reply.id)

    expect(response.status).toBe(502)
    expect((await readError(response.body)).errorCode).toBe("RERENDER_FAILED")
    expect((await history(model.layer))[0]).toEqual(reply)
  })

  it("answers 503 MODEL_UNREACHABLE when the model cannot be reached, keeping the row", async () => {
    const { model, reply } = await chatWithBrokenReply(unreachable)

    const response = await rerender(model.layer, reply.id)

    expect(response.status).toBe(503)
    expect(await readError(response.body)).toEqual(
      anError("MODEL_UNREACHABLE", { reason: "NetworkError" }),
    )
    expect((await history(model.layer))[0]).toEqual(reply)
  })

  it("answers 404 MESSAGE_NOT_FOUND for an id no message has, without calling the model", async () => {
    const model = scriptedLanguageModel()

    const response = await rerender(model.layer, "no-such-message")

    expect(response.status).toBe(404)
    expect(await readError(response.body)).toEqual(
      anError("MESSAGE_NOT_FOUND", { id: "no-such-message" }),
    )
    expect(model.calls).toHaveLength(0)
  })

  it("answers 404 MESSAGE_NOT_FOUND for the user's own message", async () => {
    const model = scriptedLanguageModel(textReply(brokenReply))
    await sendChat(model.layer, { message: "show exp_1", clientDate })
    const user = (await history(model.layer)).find((message) => message.role === "user")!

    const response = await rerender(model.layer, user.id)

    expect(response.status).toBe(404)
    expect(await readError(response.body)).toEqual(anError("MESSAGE_NOT_FOUND", { id: user.id }))
    expect(model.calls).toHaveLength(1)
  })
})
