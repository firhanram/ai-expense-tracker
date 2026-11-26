import type { ChatMessage, Expense } from "@expense/contract"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderApp } from "../../shared/testing/renderApp.tsx"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const reply = (text: string) =>
  new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "exp_1",
  amount: 146500,
  categoryId: 1,
  merchant: "Indomaret",
  note: "weekly shop",
  occurredAt: "2026-11-22",
  createdAt: "2026-11-22T03:00:00.000Z",
  status: "confirmed",
  needsReview: false,
  receiptKey: null,
  ...overrides,
})

const message = (
  id: string,
  role: ChatMessage["role"],
  content: string,
  uiText: string | null = null,
): ChatMessage => ({ id, role, content, uiText, createdAt: "2026-11-25T03:00:00.000Z" })

let sends = 0

const serve = (server: {
  readonly history?: ReadonlyArray<ChatMessage>
  readonly expenses?: ReadonlyArray<Expense>
  readonly replies?: ReadonlyArray<string>
}) => {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.pathname === "/api/chat" && request.method === "GET") {
      return json(200, {
        success: true,
        data: { messages: [...(server.history ?? [])].toReversed(), nextBefore: null },
      })
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      sends += 1
      return reply(server.replies?.[sends - 1] ?? "")
    }
    if (url.pathname === "/api/expenses") {
      const status = url.searchParams.get("status") ?? "confirmed"
      return json(200, {
        success: true,
        data: (server.expenses ?? []).filter((candidate) => candidate.status === status),
      })
    }
    return json(404, { success: false, error: { errorId: "e", errorCode: "NOT_FOUND" } })
  })
}

const log = () => screen.getByRole("log")
const composer = () => screen.getByRole("textbox", { name: "Message" })

beforeEach(() => {
  sends = 0
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-25T10:00:00+07:00") })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("generated UI in a stored Chat", () => {
  it("renders a stored reply's Expense card from the record, after a reload", async () => {
    serve({
      expenses: [expense()],
      history: [
        message("m1", "user", "what was that indomaret one?"),
        message(
          "m2",
          "assistant",
          "This one:",
          'root = Stack([card])\ncard = ExpenseCard("exp_1")',
        ),
      ],
    })
    await renderApp("/")

    const card = await within(log()).findByRole("article", { name: "Expense Rp146.500" })
    expect(within(card).getByText("Indomaret · 22 Nov 2026 · weekly shop")).toBeInTheDocument()
    expect(within(card).getByText("Groceries")).toBeInTheDocument()
    expect(within(card).getByText("Confirmed")).toBeInTheDocument()
    expect(within(log()).getByText("This one:")).toBeInTheDocument()
  })

  it("says so when the Expense a card points at is gone", async () => {
    serve({
      history: [
        message("m2", "assistant", "", 'root = Stack([card])\ncard = ExpenseCard("exp_9")'),
      ],
    })
    await renderApp("/")

    expect(await within(log()).findByText("This expense no longer exists")).toBeInTheDocument()
  })

  it("falls back to the prose when a stored program no longer parses", async () => {
    serve({
      history: [message("m2", "assistant", "Dining came to Rp187.000.", 'root = Chart("dining")')],
    })
    await renderApp("/")

    expect(await within(log()).findByText("Dining came to Rp187.000.")).toBeInTheDocument()
    expect(within(log()).getByText("Showing text only.")).toBeInTheDocument()
  })

  it("leaves a prose-only reply as prose", async () => {
    serve({ history: [message("m2", "assistant", "You spent Rp187.000 on dining.")] })
    await renderApp("/")

    expect(await within(log()).findByText("You spent Rp187.000 on dining.")).toBeInTheDocument()
    expect(within(log()).queryByText("Showing text only.")).toBeNull()
  })
})

describe("generated UI in a live reply", () => {
  it("renders the Expense list a streamed program asks for", async () => {
    serve({
      expenses: [expense(), expense({ id: "exp_2", merchant: "Uniqlo", categoryId: 6 })],
      replies: [
        'November so far:\n\n```openui-lang\nroot = Stack([list])\nlist = ExpenseList("confirmed", "2026-11-01", "2026-11-30")\n```',
      ],
    })
    await renderApp("/")

    await userEvent.type(composer(), "show november{Enter}")

    const list = await within(log()).findByRole("region", { name: "Expenses" })
    expect(await within(list).findByText("Uniqlo")).toBeInTheDocument()
    expect(within(list).getByText("Indomaret")).toBeInTheDocument()
    expect(within(log()).getByText("November so far:")).toBeInTheDocument()
  })

  it("shows the prose with one Retry when the program fails, and sends again on Retry", async () => {
    const broken = "Here you go.\n\n```openui-lang\nroot = Stack([card]\n```"
    serve({ replies: [broken, broken] })
    await renderApp("/")

    await userEvent.type(composer(), "show it{Enter}")
    expect(await within(log()).findByText("Showing text only.")).toBeInTheDocument()
    expect(within(log()).getByText("Here you go.")).toBeInTheDocument()

    await userEvent.click(within(log()).getByRole("button", { name: "Retry" }))

    expect(await within(log()).findByText("Showing text only.")).toBeInTheDocument()
    expect(sends).toBe(2)
    expect(within(log()).queryByRole("button", { name: "Retry" })).toBeNull()
  })
})
