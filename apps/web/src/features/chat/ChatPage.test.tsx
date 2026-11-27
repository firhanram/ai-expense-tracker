import { type ChatMessage, SendChatMessage } from "@expense/contract"
import { Schema } from "effect"
import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderApp } from "../../shared/testing/renderApp.tsx"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const failure = (status: number, errorCode: string) =>
  json(status, { success: false, error: { errorId: "e", errorCode, message: errorCode } })

/** A reply the test writes into word by word, then ends. */
const openReply = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    response: new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } }),
    write: (text: string) => controller.enqueue(new TextEncoder().encode(text)),
    end: () => controller.close(),
  }
}

const reply = (text: string) =>
  new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } })

const message = (
  id: string,
  role: ChatMessage["role"],
  content: string,
  uiText: string | null = null,
): ChatMessage => ({ id, role, content, uiText, createdAt: "2026-11-25T03:00:00.000Z" })

interface Server {
  /** Each `GET /api/chat`, by its `before` (null for the newest page). */
  readonly history?: (before: string | null) => Response
  /** Each `POST /api/chat`, in order. */
  readonly send?: (body: SendChatMessage, index: number) => Response | Promise<Response>
}

let sent: Array<SendChatMessage>

const serve = (server: Server) => {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.pathname === "/api/chat" && request.method === "GET") {
      return (
        server.history?.(url.searchParams.get("before")) ??
        json(200, { success: true, data: { messages: [], nextBefore: null } })
      )
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const body = Schema.decodeUnknownSync(SendChatMessage)(await request.json())
      sent.push(body)
      return server.send?.(body, sent.length - 1) ?? reply("")
    }
    return failure(404, "NOT_FOUND")
  })
}

const page = (messages: ReadonlyArray<ChatMessage>, nextBefore: string | null = null) =>
  json(200, { success: true, data: { messages, nextBefore } })

const composer = () => screen.getByRole("textbox", { name: "Message" })
const log = () => screen.getByRole("log")

beforeEach(() => {
  sent = []
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-25T10:00:00+07:00") })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("the empty Chat", () => {
  it("shows the headline and example prompts, and a prompt fills the composer", async () => {
    serve({})
    await renderApp("/")

    expect(
      await screen.findByRole("heading", { name: "Where did your money go?" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Scan a receipt/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /See this month/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /Log a purchase/ }))

    expect(composer()).toHaveValue("buy cloth 70rb")
    expect(composer()).toHaveFocus()
  })

  it("fills the report prompt from 'See this month'", async () => {
    serve({})
    await renderApp("/")

    await userEvent.click(await screen.findByRole("button", { name: /See this month/ }))

    expect(composer()).toHaveValue("report of my expenses this month")
  })
})

describe("history", () => {
  it("shows the stored Chat oldest to newest, without the example prompts", async () => {
    serve({
      history: () =>
        page([
          message("m2", "assistant", "Logged Rp70.000 at Uniqlo."),
          message("m1", "user", "buy cloth 70rb"),
        ]),
    })
    await renderApp("/")

    const user = await within(log()).findByText("buy cloth 70rb")
    const assistant = within(log()).getByText("Logged Rp70.000 at Uniqlo.")
    expect(user.compareDocumentPosition(assistant) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Where did your money go?" })).toBeNull()
  })

  it("shows only the prose of a stored reply that carried a program", async () => {
    serve({
      history: () =>
        page([
          message("m2", "assistant", "Here it is.", "root = Stack([])"),
          message("m1", "user", "hi"),
        ]),
    })
    await renderApp("/")

    expect(await within(log()).findByText("Here it is.")).toBeInTheDocument()
    expect(within(log()).queryByText(/root =/)).toBeNull()
  })

  it("says the owner is not signed in when the Chat cannot load, and offers a reload", async () => {
    const reload = vi.fn<() => void>()
    const { href, origin, pathname, search, hash } = window.location
    vi.stubGlobal("location", { href, origin, pathname, search, hash, reload })
    serve({ history: () => failure(401, "UNAUTHORIZED") })
    await renderApp("/")

    const line = await within(log()).findByText(/^Not signed in\./)
    expect(line.closest("p")).toHaveTextContent("Not signed in. Reload to sign in again.")

    await userEvent.click(within(log()).getByRole("button", { name: "Reload" }))
    expect(reload).toHaveBeenCalledOnce()
  })
})

describe("sending", () => {
  it("shows the message, then the reply as it streams, with today's date", async () => {
    const stream = openReply()
    serve({ send: () => stream.response })
    await renderApp("/")

    await userEvent.type(composer(), "buy cloth 70rb{Enter}")

    expect(within(log()).getByText("buy cloth 70rb")).toBeInTheDocument()
    expect(composer()).toHaveValue("")
    expect(sent).toEqual([{ message: "buy cloth 70rb", clientDate: "2026-11-25" }])

    stream.write("Logged ")
    expect(await within(log()).findByText("Logged")).toBeInTheDocument()
    stream.write("Rp70.000.")
    expect(await within(log()).findByText("Logged Rp70.000.")).toBeInTheDocument()
    stream.end()
  })

  it("adds a line on Shift+Enter instead of sending", async () => {
    serve({})
    await renderApp("/")

    await userEvent.type(composer(), "first{Shift>}{Enter}{/Shift}second")

    expect(composer()).toHaveValue("first\nsecond")
    expect(sent).toEqual([])
  })

  it("does not send blank text", async () => {
    serve({})
    await renderApp("/")

    await userEvent.type(composer(), "   {Enter}")

    expect(sent).toEqual([])
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("keeps the composer open while a reply streams and sends the next message after it", async () => {
    const first = openReply()
    serve({ send: (_, index) => (index === 0 ? first.response : reply("Second reply.")) })
    await renderApp("/")

    await userEvent.type(composer(), "one{Enter}")
    first.write("First reply")
    await within(log()).findByText("First reply")

    await userEvent.type(composer(), "two{Enter}")
    expect(composer()).toBeEnabled()
    expect(within(log()).getByText("two")).toBeInTheDocument()
    expect(sent.map((body) => body.message)).toEqual(["one"])

    first.end()
    expect(await within(log()).findByText("Second reply.")).toBeInTheDocument()
    expect(sent.map((body) => body.message)).toEqual(["one", "two"])
  })

  it("shows the prose of a streamed reply that writes a program", async () => {
    serve({ send: () => reply("Here it is.\n\n```openui-lang\nroot = Stack([])\n```") })
    await renderApp("/")

    await userEvent.type(composer(), "show{Enter}")

    expect(await within(log()).findByText("Here it is.")).toBeInTheDocument()
    expect(within(log()).queryByText(/root =/)).toBeNull()
  })
})

describe("the date picker", () => {
  it("sends the picked date as clientDate and goes back to Today after sending", async () => {
    serve({ send: () => reply("Noted.") })
    await renderApp("/")

    await userEvent.click(screen.getByRole("button", { name: "Expense date: Today" }))
    await userEvent.click(await screen.findByRole("button", { name: /Yesterday/ }))

    expect(screen.getByRole("button", { name: "Expense date: Yesterday" })).toBeInTheDocument()

    await userEvent.type(composer(), "lunch 45rb{Enter}")

    expect(sent).toEqual([{ message: "lunch 45rb", clientDate: "2026-11-24" }])
    expect(screen.getByRole("button", { name: "Expense date: Today" })).toBeInTheDocument()
  })

  it("offers a Monday-first calendar where later days cannot be picked", async () => {
    serve({})
    await renderApp("/")

    await userEvent.click(screen.getByRole("button", { name: "Expense date: Today" }))
    const grid = await screen.findByRole("grid", { name: /November 2026/ })

    const headers = within(grid).getAllByRole("columnheader")
    expect(headers[0]).toHaveAccessibleName("Monday")
    expect(within(grid).getByRole("gridcell", { name: /November 26, 2026/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    )

    await userEvent.click(within(grid).getByRole("gridcell", { name: /November 20, 2026/ }))

    expect(screen.getByRole("button", { name: "Expense date: Fri, 20 Nov" })).toBeInTheDocument()
  })
})

describe("errors", () => {
  it("says the model could not be reached, and Retry sends the message again", async () => {
    serve({
      send: (_, index) => (index === 0 ? failure(503, "MODEL_UNREACHABLE") : reply("Logged.")),
    })
    await renderApp("/")

    await userEvent.type(composer(), "lunch 45rb{Enter}")

    expect(await within(log()).findByText(/Couldn't reach the model\./)).toBeInTheDocument()

    await userEvent.click(within(log()).getByRole("button", { name: "Retry" }))

    expect(await within(log()).findByText("Logged.")).toBeInTheDocument()
    expect(within(log()).queryByText(/Couldn't reach the model\./)).toBeNull()
    expect(sent.map((body) => body.message)).toEqual(["lunch 45rb", "lunch 45rb"])
  })

  it("tells an empty reply apart from an unreachable model", async () => {
    serve({ send: () => reply("") })
    await renderApp("/")

    await userEvent.type(composer(), "hello{Enter}")

    expect(await within(log()).findByText("No reply.")).toBeInTheDocument()
    expect(within(log()).queryByText(/Couldn't reach the model/)).toBeNull()
  })

  it("says the owner is not signed in when the send is refused", async () => {
    serve({ send: () => failure(401, "UNAUTHORIZED") })
    await renderApp("/")

    await userEvent.type(composer(), "hello{Enter}")

    const line = await within(log()).findByText(/^Not signed in\./)
    expect(line.closest("p")).toHaveTextContent("Not signed in. Reload to sign in again.")
    expect(within(log()).queryByRole("button", { name: "Retry" })).toBeNull()
  })

  it("shows the offline bar while the connection is down", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    serve({})
    await renderApp("/")

    expect(
      await screen.findByText("Offline. Messages will send when reconnected."),
    ).toBeInTheDocument()
  })

  it("holds a message sent offline and sends it once reconnected", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    serve({ send: () => reply("Logged.") })
    await renderApp("/")

    await userEvent.type(composer(), "lunch 45rb{Enter}")
    expect(within(log()).getByText("lunch 45rb")).toBeInTheDocument()
    expect(sent).toEqual([])

    online.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event("online"))
    })

    expect(await within(log()).findByText("Logged.")).toBeInTheDocument()
    expect(sent.map((body) => body.message)).toEqual(["lunch 45rb"])
    expect(screen.queryByText("Offline. Messages will send when reconnected.")).toBeNull()
  })
})
