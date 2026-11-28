import type { ChatHistoryPage, Expense } from "@expense/contract"
import { checkProgram, parseProgram } from "@expense/ui"
import { env } from "cloudflare:workers"
import { Schema } from "effect"
import type { Prompt } from "effect/ai"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"
import { sendChat } from "../../testing/callWithModel.ts"
import {
  type FakeReply,
  scriptedLanguageModel,
  textReply,
  toolCallReply,
  toolResultsIn,
} from "../../testing/FakeLanguageModel.ts"
import { jpeg, uploadReceipt } from "../../testing/receipts.ts"
import { anError, readData, readError } from "../../testing/envelope.ts"

const clientDate = "2026-11-25"

// Tests in one file share D1; each starts from an empty Chat and ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM chat_message").run()
  await env.DB.prepare("DELETE FROM expense").run()
})

const upload = async () => {
  const { receiptKey } = await uploadReceipt(jpeg)
  return receiptKey!
}

const drafts = async (): Promise<Array<Expense>> => {
  const response = await callApi("/api/expenses?status=draft")
  return readData(response)
}

/** Ids of the Drafts `propose_expense` returned so far this turn. */
const proposedIds = (prompt: Prompt.Prompt) =>
  toolResultsIn(prompt).flatMap((result) =>
    result.name === "propose_expense" && !result.isFailure
      ? [Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))(result.result).id]
      : [],
  )

/** A program showing a Draft card for `id`. */
const card = (id: string) =>
  ["```openui-lang", "root = Stack([d])", `d = DraftExpenseCard("${id}")`, "```"].join("\n")

/** A reply that shows the Draft proposed this turn. */
const showDraft = (prompt: Prompt.Prompt): FakeReply =>
  textReply(`From your receipt:\n${card(proposedIds(prompt)[0]!)}`)

const proposeFromReceipt = (amount: number, needsReview: boolean) =>
  toolCallReply("propose_expense", {
    amount,
    merchant: "Superindo",
    categoryName: "Groceries",
    note: null,
    needsReview,
  })

/** The parts of the last user message the model was sent. */
const lastUserParts = (prompt: Prompt.Prompt) =>
  prompt.content.findLast((message) => message.role === "user")?.content ?? []

describe("a Chat turn with a Receipt", () => {
  it("attaches the Receipt's image to the user's message", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(textReply("Reading it."))

    await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    const parts = lastUserParts(model.calls[0]!.prompt)
    expect(parts).toContainEqual(expect.objectContaining({ type: "text", text: "this one" }))
    expect(parts).toContainEqual(
      expect.objectContaining({ type: "file", mediaType: "image/jpeg", data: jpeg }),
    )
  })

  it("keeps the Receipt on the stored user message, so the Chat still shows it after a reload", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(textReply("Reading it."))

    await sendChat(model.layer, { message: "this one", clientDate, receiptKey })
    await sendChat(scriptedLanguageModel(textReply("Noted.")).layer, {
      message: "and lunch 25rb",
      clientDate,
    })

    const history = await callApi("/api/chat").then(readData<ChatHistoryPage>)
    expect(history.messages.toReversed()).toMatchObject([
      { role: "user", content: "this one", receiptKey },
      { role: "assistant", receiptKey: null },
      { role: "user", content: "and lunch 25rb", receiptKey: null },
      { role: "assistant", receiptKey: null },
    ])
  })

  it("proposes a Draft that holds the Receipt and is marked for review when the model was unsure", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(proposeFromReceipt(84500, true), showDraft)

    await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    const [draft, ...others] = await drafts()
    expect(others).toEqual([])
    expect(draft).toMatchObject({ amount: 84500, receiptKey, needsReview: true })
  })

  it("resumes the Draft a Receipt already became instead of creating a second", async () => {
    const receiptKey = await upload()
    await sendChat(scriptedLanguageModel(proposeFromReceipt(84500, true), showDraft).layer, {
      message: "this one",
      clientDate,
      receiptKey,
    })
    const [first] = await drafts()

    // The same Receipt again; the model proposes anew despite being told.
    const again = scriptedLanguageModel(proposeFromReceipt(85400, false), showDraft)
    await sendChat(again.layer, { message: "the total is 85.400", clientDate, receiptKey })

    const told = again.calls[0]!.prompt.content.some(
      (message) =>
        message.role === "system" && message.content.includes(`already Draft Expense ${first!.id}`),
    )
    expect(told).toBe(true)
    expect(await drafts()).toEqual([
      expect.objectContaining({ id: first!.id, amount: 85400, receiptKey, needsReview: false }),
    ])
  })

  it("does not make a second Draft when the model proposes twice in one turn", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(
      proposeFromReceipt(84500, false),
      proposeFromReceipt(84500, false),
      showDraft,
    )

    await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    expect(await drafts()).toHaveLength(1)
  })

  it("still yields a Draft to fill in when the model could not read the Receipt", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(textReply("I can't make out this receipt."))

    const response = await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    const [draft, ...others] = await drafts()
    expect(others).toEqual([])
    expect(draft).toMatchObject({
      amount: 0,
      categoryId: 11,
      merchant: null,
      occurredAt: clientDate,
      needsReview: true,
      receiptKey,
    })
    expect(response.body).toContain("I can't make out this receipt.")
    expect(response.body).toContain(`DraftExpenseCard("${draft!.id}")`)
    const { messages } = await callApi("/api/chat").then(readData<ChatHistoryPage>)
    expect(messages[0]).toMatchObject({
      role: "assistant",
      uiText: expect.stringContaining(`DraftExpenseCard("${draft!.id}")`),
    })
  })

  it("adds the placeholder's card to the program the model wrote, so the reply stores one program", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(
      textReply(
        [
          "I can't read it. Your other drafts:",
          "```openui-lang",
          "root = Stack([receipt])",
          'receipt = ExpenseList("draft")',
          "```",
        ].join("\n"),
      ),
    )

    await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    const [draft] = await drafts()
    const { messages } = await callApi("/api/chat").then(readData<ChatHistoryPage>)
    const uiText = messages[0]!.uiText!
    expect(uiText.match(/^\s*root\s*=/gm)).toHaveLength(1)
    expect(checkProgram(uiText).outcome).toBe("ok")
    const children = parseProgram(uiText).root?.props["children"]
    expect(children).toMatchObject([
      { typeName: "ExpenseList", props: { status: "draft" } },
      { typeName: "DraftExpenseCard", props: { id: draft!.id } },
    ])
  })

  it("adds no placeholder when the model proposed from the Receipt itself", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(proposeFromReceipt(84500, false), showDraft)

    const response = await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    expect(await drafts()).toHaveLength(1)
    expect(response.body.match(/DraftExpenseCard/g)).toHaveLength(1)
  })

  it("makes the model propose a Draft first when the Receipt is not yet one", async () => {
    const receiptKey = await upload()
    const model = scriptedLanguageModel(proposeFromReceipt(84500, false), showDraft)

    await sendChat(model.layer, { message: "this one", clientDate, receiptKey })

    expect(model.calls.map((call) => call.toolChoice)).toEqual([
      { tool: "propose_expense" },
      "auto",
    ])
  })

  it("leaves the tools to the model when the Receipt is already a Draft", async () => {
    const receiptKey = await upload()
    await sendChat(scriptedLanguageModel(proposeFromReceipt(84500, true), showDraft).layer, {
      message: "this one",
      clientDate,
      receiptKey,
    })
    const [draft] = await drafts()

    const again = scriptedLanguageModel(textReply(`Still this one:\n${card(draft!.id)}`))
    await sendChat(again.layer, { message: "and this?", clientDate, receiptKey })

    expect(again.calls.map((call) => call.toolChoice)).toEqual(["auto"])
  })

  it("sends the model back when it shows a card with an id no tool returned, so the Receipt gets its real Draft", async () => {
    const receiptKey = await upload()
    const invented = "7f3c2a91-5d64-4b18-9e07-2c81b6a4d3f5"
    const model = scriptedLanguageModel(
      textReply(`Totalnya Rp9.800 di Alfamart:\n${card(invented)}`),
      proposeFromReceipt(9800, false),
      showDraft,
    )

    const response = await sendChat(model.layer, {
      message: "Beli di Alfamidi",
      clientDate,
      receiptKey,
    })

    const correction = model.calls[1]!.prompt.content.at(-1)
    expect(correction).toMatchObject({ role: "system", content: expect.stringContaining(invented) })
    const [draft, ...others] = await drafts()
    expect(others).toEqual([])
    expect(draft).toMatchObject({ amount: 9800, receiptKey })
    expect(response.body).not.toContain("I could not read everything")
    const { messages } = await callApi("/api/chat").then(readData<ChatHistoryPage>)
    const children = parseProgram(messages[0]!.uiText!).root?.props["children"]
    expect(children).toMatchObject([{ typeName: "DraftExpenseCard", props: { id: draft!.id } }])
  })

  it("refuses a key with no stored Receipt and keeps nothing of the turn", async () => {
    const model = scriptedLanguageModel()

    const response = await sendChat(model.layer, {
      message: "this one",
      clientDate,
      receiptKey: "no-such-receipt",
    })

    expect(response.status).toBe(404)
    expect(await readError(response.body)).toEqual(
      anError("RECEIPT_NOT_FOUND", { receiptKey: "no-such-receipt" }),
    )
    expect(model.calls).toEqual([])
    const history = await callApi("/api/chat").then(readData)
    expect(history).toMatchObject({ messages: [] })
  })
})
