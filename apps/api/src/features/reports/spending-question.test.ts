import { env } from "cloudflare:workers"
import type { Prompt } from "effect/ai"
import { beforeEach, describe, expect, it } from "vitest"
import { sendChat } from "../../testing/callWithModel.ts"
import { scriptedLanguageModel, textReply, toolCallReply } from "../../testing/FakeLanguageModel.ts"

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM expense").run()
  await env.DB.prepare("DELETE FROM chat_message").run()
})

/** The tool results the model was sent back, as it reads them. */
const toolResultsIn = (prompt: Prompt.Prompt) =>
  prompt.content.flatMap((message) =>
    message.role === "tool"
      ? message.content.flatMap((part) =>
          part.type === "tool-result" ? [{ name: part.name, result: part.result }] : [],
        )
      : [],
  )

describe("a spending question in the Chat", () => {
  it("is answered from the totals query_spending computed on the server", async () => {
    await env.DB.prepare(
      `INSERT INTO expense (id, amount, category_id, occurred_at, created_at, status)
       VALUES ('a', 45000, 2, '2026-10-04', '2026-10-04T00:00:00Z', 'confirmed'),
              ('b', -5000, 2, '2026-10-09', '2026-10-09T00:00:00Z', 'confirmed')`,
    ).run()
    const model = scriptedLanguageModel(
      toolCallReply("query_spending", {
        from: "2026-10-01",
        to: "2026-10-31",
        groupBy: "category",
      }),
      textReply("You spent Rp40.000 on Dining last month."),
    )

    const response = await sendChat(model.layer, {
      message: "how much did I spend on food last month?",
      clientDate: "2026-11-25",
    })

    expect(response.status).toBe(200)
    expect(response.body).toBe("You spent Rp40.000 on Dining last month.")
    expect(model.calls[0]?.toolNames).toContain("query_spending")
    const [second] = model.calls.slice(1)
    expect(second && toolResultsIn(second.prompt)).toEqual([
      {
        name: "query_spending",
        result: {
          from: "2026-10-01",
          to: "2026-10-31",
          groupBy: "category",
          total: 40000,
          totals: [{ label: "Dining", categoryId: 2, amount: 40000 }],
        },
      },
    ])
  })
})
