import { env } from "cloudflare:workers"
import { ChatHistoryPage } from "@expense/contract"
import { systemPrompt } from "@expense/ui/server"
import { type Layer, Schema } from "effect"
import type { LanguageModel, Prompt } from "effect/ai"
import { beforeEach, describe, expect, it } from "vitest"
import { callApiWithModel, sendChat } from "../../testing/callWithModel.ts"
import {
  failsMidway,
  makeFakeLanguageModel,
  scriptedLanguageModel,
  textReply,
  unreachable,
} from "../../testing/FakeLanguageModel.ts"

const clientDate = "2026-11-25"

// Tests in one file share D1; each starts from an empty Chat.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM chat_message").run()
})

const history = async (
  model: Layer.Layer<LanguageModel.LanguageModel>,
  query = "",
): Promise<ChatHistoryPage> => {
  const response = await callApiWithModel(model, `/api/chat${query}`)
  expect(response.status).toBe(200)
  return Schema.decodeUnknownSync(ChatHistoryPage)(JSON.parse(response.body))
}

const bubbles = (page: ChatHistoryPage) =>
  page.messages.map((message) => [message.role, message.content])

/** The text of every message the model was sent, as `role: text`. */
const transcript = (prompt: Prompt.Prompt) =>
  prompt.content.map((message) =>
    typeof message.content === "string"
      ? `${message.role}: ${message.content}`
      : `${message.role}: ${message.content.map((part) => ("text" in part ? part.text : "")).join("")}`,
  )

describe("POST /api/chat", () => {
  it("streams the model's prose back as plain text", async () => {
    const model = scriptedLanguageModel(textReply("Hello", " there"))

    const response = await sendChat(model.layer, { message: "hi", clientDate })

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(response.body).toBe("Hello there")
  })

  it("gives the model the recent Chat, the client's date, and the new message", async () => {
    const model = scriptedLanguageModel(textReply("Hi!"), textReply("Noted."))
    await sendChat(model.layer, { message: "hello", clientDate })

    await sendChat(model.layer, { message: "I spent 70rb", clientDate: "2026-11-26" })

    const sent = transcript(model.calls[1]!.prompt)
    expect(sent[0]).toMatch(/^system: /)
    expect(sent.slice(1)).toEqual([
      "user: hello",
      "assistant: Hi!",
      "system: The user's local date today is 2026-11-26.",
      "user: I spent 70rb",
    ])
  })

  it("tells the model, first, what the component library lets it render", async () => {
    const model = scriptedLanguageModel(textReply("Hi!"))

    await sendChat(model.layer, { message: "hello", clientDate })

    expect(model.calls[0]!.prompt.content[0]).toMatchObject({
      role: "system",
      content: systemPrompt,
    })
  })

  it("streams a reply with a program as written, and stores its prose and program apart", async () => {
    const reply = [
      "Here it is:\n```openui-lang\nroot = Stack([c])\n",
      'c = ExpenseCard("exp_1")\n```\nAnything else?',
    ]
    const model = scriptedLanguageModel(textReply(...reply))

    const response = await sendChat(model.layer, { message: "show exp_1", clientDate })

    expect(response.body).toBe(reply.join(""))
    const [stored] = (await history(model.layer)).messages
    expect(stored).toMatchObject({
      role: "assistant",
      content: "Here it is:\n\nAnything else?",
      uiText: 'root = Stack([c])\nc = ExpenseCard("exp_1")',
    })
  })

  it("shows the model its earlier programs, so it can see what it rendered", async () => {
    const model = scriptedLanguageModel(
      textReply('Done.\n```openui-lang\nroot = Stack([ExpenseCard("exp_1")])\n```'),
      textReply("Sure."),
    )
    await sendChat(model.layer, { message: "show it", clientDate })

    await sendChat(model.layer, { message: "thanks", clientDate })

    expect(transcript(model.calls[1]!.prompt)[2]).toBe(
      'assistant: Done.\n\n```openui-lang\nroot = Stack([ExpenseCard("exp_1")])\n```',
    )
  })

  it("answers 503 ModelUnreachable when the model cannot be reached, keeping the message", async () => {
    const model = makeFakeLanguageModel(unreachable)

    const response = await sendChat(model.layer, { message: "hi", clientDate })

    expect(response.status).toBe(503)
    expect(JSON.parse(response.body)).toEqual({ _tag: "ModelUnreachable", reason: "NetworkError" })
    expect(bubbles(await history(model.layer))).toEqual([["user", "hi"]])
  })

  it("answers an empty reply with 200 and an empty body, not an error", async () => {
    const model = scriptedLanguageModel(textReply())

    const response = await sendChat(model.layer, { message: "hi", clientDate })

    expect(response.status).toBe(200)
    expect(response.body).toBe("")
    expect(bubbles(await history(model.layer))).toEqual([
      ["assistant", ""],
      ["user", "hi"],
    ])
  })

  it("stores no reply when the model fails after it started writing", async () => {
    const model = scriptedLanguageModel(failsMidway("Half a"))

    await sendChat(model.layer, { message: "hi", clientDate }).catch(() => undefined)

    expect(bubbles(await history(model.layer))).toEqual([["user", "hi"]])
  })

  it("rejects a request without the client's date, without calling the model", async () => {
    const model = scriptedLanguageModel()

    const response = await sendChat(model.layer, { message: "hi" })

    expect(response.status).toBe(400)
    expect(model.calls).toHaveLength(0)
  })

  it("rejects an empty message", async () => {
    const model = scriptedLanguageModel()

    const response = await sendChat(model.layer, { message: "", clientDate })

    expect(response.status).toBe(400)
  })
})

describe("GET /api/chat", () => {
  it("returns the Chat newest first, with the stored reply", async () => {
    const model = scriptedLanguageModel(textReply("Hi", "!"), textReply("Sure."))
    await sendChat(model.layer, { message: "hello", clientDate })
    await sendChat(model.layer, { message: "help me", clientDate })

    const page = await history(model.layer)

    expect(bubbles(page)).toEqual([
      ["assistant", "Sure."],
      ["user", "help me"],
      ["assistant", "Hi!"],
      ["user", "hello"],
    ])
    expect(page.messages[0]).toMatchObject({ uiText: null })
    expect(page.nextBefore).toBeNull()
  })

  it("is empty for a new Chat", async () => {
    const page = await history(scriptedLanguageModel().layer)

    expect(page).toEqual({ messages: [], nextBefore: null })
  })

  it("pages backwards from nextBefore", async () => {
    const model = scriptedLanguageModel(textReply("one"), textReply("two"), textReply("three"))
    await sendChat(model.layer, { message: "a", clientDate })
    await sendChat(model.layer, { message: "b", clientDate })
    await sendChat(model.layer, { message: "c", clientDate })

    const newest = await history(model.layer, "?limit=4")
    const older = await history(model.layer, `?limit=4&before=${newest.nextBefore}`)

    expect(bubbles(newest)).toEqual([
      ["assistant", "three"],
      ["user", "c"],
      ["assistant", "two"],
      ["user", "b"],
    ])
    expect(bubbles(older)).toEqual([
      ["assistant", "one"],
      ["user", "a"],
    ])
    expect(older.nextBefore).toBeNull()
  })

  it("rejects a page size over the maximum", async () => {
    const response = await callApiWithModel(scriptedLanguageModel().layer, "/api/chat?limit=101")

    expect(response.status).toBe(400)
  })
})
