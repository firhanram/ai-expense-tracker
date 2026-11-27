import { describe, expect, it } from "vitest"
import { replyPhase } from "./replyPhase.ts"

const reply = (content: string, uiText: string | null = null) => ({ content, uiText })

describe("replyPhase", () => {
  it("reads the message before anything has streamed", () => {
    expect(replyPhase(reply(""), false)).toEqual({ label: "Reading your message", shape: null })
  })

  it("reads the receipt when the turn carried one", () => {
    expect(replyPhase(reply(""), true)).toEqual({ label: "Reading your receipt", shape: null })
  })

  it("steps aside while prose streams, since the text is the progress", () => {
    expect(replyPhase(reply("Logged Rp70.000"), false)).toBeNull()
  })

  it("names the block a streaming program draws, once the stream shows it", () => {
    expect(replyPhase(reply("", "root = Stack([card])"), false)).toEqual({
      label: "Preparing the answer",
      shape: null,
    })
    expect(
      replyPhase(reply("", 'root = Stack([card])\ncard = DraftExpenseCard("exp_1")'), false),
    ).toEqual({ label: "Drafting your expense", shape: "draft" })
    expect(replyPhase(reply("Here.", "chart = SpendingChart("), false)).toEqual({
      label: "Building the chart",
      shape: "chart",
    })
    expect(replyPhase(reply("", 'list = ExpenseList("confirmed"'), false)).toEqual({
      label: "Pulling up your expenses",
      shape: "list",
    })
  })
})
