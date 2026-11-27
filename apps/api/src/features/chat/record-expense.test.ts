import type { ChatHistoryPage, Expense } from "@expense/contract"
import { env } from "cloudflare:workers"
import { Effect, Schema, Stream } from "effect"
import type { Prompt, Response } from "effect/ai"
import { beforeEach, describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"
import { sendChat, sendChatAndLeave } from "../../testing/callWithModel.ts"
import {
  type FakeReply,
  scriptedLanguageModel,
  textReply,
  toolCallReply,
  toolResultsIn,
} from "../../testing/FakeLanguageModel.ts"
import { readData } from "../../testing/envelope.ts"

const clientDate = "2026-11-25"

// Tests in one file share D1; each starts from an empty Chat and ledger.
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM chat_message").run()
  await env.DB.prepare("DELETE FROM expense").run()
})

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

/** A program showing a card per id, as the system prompt asks. */
const cards = (ids: ReadonlyArray<string>) =>
  [
    "```openui-lang",
    `root = Stack([${ids.map((_, i) => `d${i}`).join(", ")}])`,
    ...ids.map((id, i) => `d${i} = DraftExpenseCard("${id}")`),
    "```",
  ].join("\n")

/** A reply that shows every Draft proposed so far this turn. */
const showDrafts = (prompt: Prompt.Prompt): FakeReply =>
  textReply(`Here is your draft:\n${cards(proposedIds(prompt))}`)

const proposeCloth = toolCallReply("propose_expense", {
  amount: 70000,
  merchant: null,
  categoryName: "Shopping",
  note: "cloth",
  needsReview: false,
})

/** Renders the proposed card and asks for another tool in the same reply. */
const showAndCarryOn = (prompt: Prompt.Prompt): FakeReply => {
  const [id] = proposedIds(prompt)
  return [
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: `Drafted:\n${cards([id!])}` },
    { type: "text-end", id: "t" },
    { type: "tool-call", id: "again", name: "get_expense", params: { id: id! } },
    { type: "finish", reason: "tool-calls", usage: { inputTokens: {}, outputTokens: {} } },
  ]
}

/** Proposes a Draft of `amount` in `categoryName`, on the client's date. */
const propose = (amount: number, categoryName: string) =>
  toolCallReply("propose_expense", {
    amount,
    merchant: null,
    categoryName,
    note: null,
    needsReview: false,
  })

/** Records "buy cloth 70rb" and returns the Draft's id. */
const recordCloth = async () => {
  await sendChat(scriptedLanguageModel(proposeCloth, showDrafts).layer, {
    message: "buy cloth 70rb",
    clientDate,
  })
  const [draft] = await drafts()
  return draft!.id
}

describe("recording an Expense by chatting", () => {
  it("offers the model the draft tools and no way to confirm (ADR-0007)", async () => {
    const model = scriptedLanguageModel(textReply("Hi!"))

    await sendChat(model.layer, { message: "hi", clientDate })

    const names = model.calls[0]!.toolNames
    expect(names).toEqual(
      expect.arrayContaining([
        "search_categories",
        "propose_expense",
        "update_draft",
        "discard_draft",
        "get_expense",
        "query_spending",
      ]),
    )
    expect(names.filter((name) => /confirm/i.test(name))).toEqual([])
    expect(await drafts()).toEqual([])
  })

  it('turns "buy cloth 70rb" into a Draft in a seeded Category, dated the client\'s day', async () => {
    const model = scriptedLanguageModel(
      toolCallReply("search_categories", {}),
      proposeCloth,
      showDrafts,
    )

    const response = await sendChat(model.layer, { message: "buy cloth 70rb", clientDate })

    const [draft, ...others] = await drafts()
    expect(others).toEqual([])
    expect(draft).toMatchObject({
      amount: 70000,
      categoryId: 6,
      merchant: null,
      note: "cloth",
      occurredAt: clientDate,
      status: "draft",
      needsReview: false,
    })
    expect(response.body).toContain(`DraftExpenseCard("${draft!.id}")`)
    expect(toolResultsIn(model.calls[1]!.prompt)[0]!.result).toContainEqual({
      id: 6,
      name: "Shopping",
    })
  })

  it("stops the turn once the proposed Draft has been rendered, even if the model wants more", async () => {
    const model = scriptedLanguageModel(proposeCloth, showAndCarryOn, textReply("unreachable"))

    const response = await sendChat(model.layer, { message: "buy cloth 70rb", clientDate })

    expect(model.calls).toHaveLength(2)
    expect(response.body).not.toContain("unreachable")
    expect(await drafts()).toHaveLength(1)
  })

  it("goes on while a proposed Draft is not yet rendered", async () => {
    const model = scriptedLanguageModel(
      proposeCloth,
      toolCallReply("search_categories", {}),
      showDrafts,
    )

    await sendChat(model.layer, { message: "buy cloth 70rb", clientDate })

    expect(model.calls).toHaveLength(3)
  })

  it("keeps every Draft when several Expenses are recorded in a row", async () => {
    const model = scriptedLanguageModel(
      propose(70000, "Shopping"),
      showDrafts,
      propose(35000, "dining"),
      showDrafts,
    )

    await sendChat(model.layer, { message: "buy cloth 70rb", clientDate })
    await sendChat(model.layer, { message: "lunch 35k", clientDate: "2026-11-26" })

    const saved = (await drafts()).map((draft) => [
      draft.amount,
      draft.categoryId,
      draft.occurredAt,
    ])
    expect(saved).toEqual([
      [35000, 2, "2026-11-26"],
      [70000, 6, clientDate],
    ])
  })

  it("lets the model retry a Category that is not in the seeded set", async () => {
    const model = scriptedLanguageModel(
      toolCallReply("propose_expense", {
        amount: 70000,
        merchant: null,
        categoryName: "Clothes",
        note: null,
        needsReview: false,
      }),
      proposeCloth,
      showDrafts,
    )

    await sendChat(model.layer, { message: "buy cloth 70rb", clientDate })

    const [rejected] = toolResultsIn(model.calls[1]!.prompt)
    expect(rejected).toMatchObject({ name: "propose_expense", isFailure: true })
    expect(JSON.stringify(rejected!.result)).toContain("Shopping")
    expect(await drafts()).toHaveLength(1)
  })

  it('stores no merchant or note when the model writes "null" or blank text for them', async () => {
    const model = scriptedLanguageModel(
      toolCallReply("propose_expense", {
        amount: 16000,
        merchant: "null",
        categoryName: "Shopping",
        note: "  ",
        needsReview: false,
      }),
      showDrafts,
    )

    await sendChat(model.layer, { message: "Beli makanan kucing 16rb", clientDate })

    expect(await drafts()).toMatchObject([{ amount: 16000, merchant: null, note: null }])
  })
})

describe("changing a Draft by chatting", () => {
  it("updates the fields the user corrects and leaves the rest", async () => {
    const id = await recordCloth()
    const model = scriptedLanguageModel(
      toolCallReply("update_draft", {
        id,
        amount: 75000,
        categoryName: "Other",
        occurredAt: "2026-11-24",
      }),
      textReply(`Updated:\n${cards([id])}`),
    )

    await sendChat(model.layer, { message: "it was 75rb yesterday, put it in Other", clientDate })

    expect(await drafts()).toMatchObject([
      { id, amount: 75000, categoryId: 11, occurredAt: "2026-11-24", note: "cloth" },
    ])
    expect(toolResultsIn(model.calls[1]!.prompt)[0]).toMatchObject({
      name: "update_draft",
      isFailure: false,
      result: { id, amount: 75000, categoryName: "Other" },
    })
  })

  it("clears needsReview once the user has settled what the model was unsure of", async () => {
    const id = await recordCloth()
    await env.DB.prepare("UPDATE expense SET needs_review = 1 WHERE id = ?").bind(id).run()
    const model = scriptedLanguageModel(
      toolCallReply("update_draft", { id, amount: 72000, needsReview: false }),
      textReply(`Updated:\n${cards([id])}`),
    )

    await sendChat(model.layer, { message: "it was 72rb, that's right", clientDate })

    expect(await drafts()).toMatchObject([{ id, amount: 72000, needsReview: false }])
  })

  it("discards a Draft the user no longer wants", async () => {
    const id = await recordCloth()
    const model = scriptedLanguageModel(
      toolCallReply("discard_draft", { id }),
      textReply("Discarded."),
    )

    await sendChat(model.layer, { message: "never mind, discard that", clientDate })

    expect(await drafts()).toEqual([])
    const discarded: Array<Expense> = await readData(
      await callApi("/api/expenses?status=discarded"),
    )
    expect(discarded.map((expense) => expense.id)).toEqual([id])
  })

  it("cannot change or discard a confirmed Expense", async () => {
    const id = await recordCloth()
    await callApi(`/api/expenses/${id}/confirm`, { method: "POST" })
    const model = scriptedLanguageModel(
      toolCallReply("update_draft", { id, amount: 1 }),
      toolCallReply("discard_draft", { id }),
      textReply("I can't change that one."),
    )

    await sendChat(model.layer, { message: "make it 1 rupiah, then discard it", clientDate })

    expect(toolResultsIn(model.calls[2]!.prompt).map((result) => result.isFailure)).toEqual([
      true,
      true,
    ])
    const confirmed: Array<Expense> = await readData(await callApi("/api/expenses"))
    expect(confirmed).toMatchObject([{ id, amount: 70000, status: "confirmed" }])
  })

  it("reads an Expense by id to show it", async () => {
    const id = await recordCloth()
    const model = scriptedLanguageModel(
      toolCallReply("get_expense", { id }),
      textReply("That's the one."),
    )

    await sendChat(model.layer, { message: "show me that draft", clientDate })

    expect(toolResultsIn(model.calls[1]!.prompt)[0]).toMatchObject({
      name: "get_expense",
      result: { id, amount: 70000, categoryName: "Shopping", status: "draft" },
    })
  })
})

describe("a client that leaves mid-reply", () => {
  it("still gets the whole reply stored, card and all, so the Draft is not orphaned", async () => {
    let leave!: () => void
    const left = new Promise<void>((resolve) => (leave = resolve))
    const usage = { inputTokens: {}, outputTokens: {} }
    const model = scriptedLanguageModel(proposeCloth, (prompt) =>
      Stream.concat(
        Stream.fromIterable<Response.StreamPartEncoded>([
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Here is your draft:\n" },
        ]),
        // The model writes the card only once the client has gone.
        Stream.fromEffect(Effect.promise(() => left)).pipe(
          Stream.flatMap(() =>
            Stream.fromIterable<Response.StreamPartEncoded>([
              { type: "text-delta", id: "t", delta: cards(proposedIds(prompt)) },
              { type: "text-end", id: "t" },
              { type: "finish", reason: "stop", usage },
            ]),
          ),
        ),
      ),
    )

    const { firstChunk } = await sendChatAndLeave(
      model.layer,
      { message: "buy cloth 70rb", clientDate },
      leave,
    )

    expect(firstChunk).not.toContain("DraftExpenseCard")
    const [draft] = await drafts()
    const page: ChatHistoryPage = await readData(await callApi("/api/chat"))
    expect(page.messages[0]).toMatchObject({
      role: "assistant",
      content: "Here is your draft:",
      uiText: `root = Stack([d0])\nd0 = DraftExpenseCard("${draft!.id}")`,
    })
  })
})
