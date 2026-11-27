import { SendChatMessage } from "@expense/contract"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Schema } from "effect"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderApp } from "../../shared/testing/renderApp.tsx"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const failure = (status: number, errorCode: string) =>
  json(status, { success: false, error: { errorId: "e", errorCode, message: errorCode } })

const uploaded = () => json(201, { success: true, data: { receiptKey: "rk-1" } })

let sent: Array<SendChatMessage>
let uploads: Array<File>

/** The Chat API, with `POST /api/receipts` answering `upload`. */
const serve = (upload: () => Response = uploaded) => {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = init?.method ?? "GET"
    if (url.pathname === "/api/chat" && method === "GET")
      return json(200, { success: true, data: { messages: [], nextBefore: null } })
    if (url.pathname === "/api/chat" && method === "POST") {
      sent.push(
        Schema.decodeUnknownSync(SendChatMessage)(
          JSON.parse(typeof init?.body === "string" ? init.body : "null"),
        ),
      )
      return new Response("Got it.", { headers: { "content-type": "text/plain" } })
    }
    if (url.pathname === "/api/receipts" && method === "POST") {
      const body = init?.body
      if (body instanceof FormData) {
        const file = body.get("file")
        if (file instanceof File) uploads.push(file)
      }
      return upload()
    }
    return failure(404, "NOT_FOUND")
  })
}

const composer = () => screen.getByRole("textbox", { name: "Message" })
const log = () => screen.getByRole("log")
const photo = (name = "receipt.jpg", type = "image/jpeg") =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], name, { type })

/** The picker's input: what the system file dialog fills in. */
const picker = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) throw new Error("No file input")
  return input
}

// The picker's native input has `pointer-events: none`.
const user = () => userEvent.setup({ pointerEventsCheck: 0 })

const attach = async (file: File) => {
  await screen.findByRole("button", { name: "Attach receipt" })
  await user().upload(picker(), file)
}

beforeEach(() => {
  sent = []
  uploads = []
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-25T10:00:00+07:00") })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("attaching a Receipt", () => {
  it("shows the photo as a pending attachment until the message is sent", async () => {
    serve()
    await renderApp("/")

    await attach(photo("indomaret.jpg"))

    expect(screen.getByText("indomaret.jpg")).toBeInTheDocument()
    expect(uploads).toEqual([])
    expect(sent).toEqual([])
  })

  it("uploads the photo on send and sends its key with the message", async () => {
    serve()
    await renderApp("/")

    await attach(photo("indomaret.jpg"))
    await userEvent.type(composer(), "here's the indomaret one{Enter}")

    expect(await within(log()).findByText("Got it.")).toBeInTheDocument()
    expect(uploads.map((file) => file.type)).toEqual(["image/jpeg"])
    expect(sent).toEqual([
      { message: "here's the indomaret one", clientDate: "2026-11-25", receiptKey: "rk-1" },
    ])
    expect(within(log()).getByText("indomaret.jpg")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /indomaret.jpg/ })).toBeNull()
  })

  it("sends a photo with no words", async () => {
    serve()
    await renderApp("/")

    await attach(photo())
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled()
    await userEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(await within(log()).findByText("Got it.")).toBeInTheDocument()
    expect(sent).toEqual([
      { message: "Here's a receipt.", clientDate: "2026-11-25", receiptKey: "rk-1" },
    ])
  })

  it("removes the attachment with its ×, so the message goes without it", async () => {
    serve()
    await renderApp("/")

    await attach(photo("indomaret.jpg"))
    await userEvent.click(screen.getByRole("button", { name: /indomaret.jpg/ }))
    expect(screen.queryByText("indomaret.jpg")).toBeNull()

    await userEvent.type(composer(), "lunch 50rb{Enter}")
    await within(log()).findByText("Got it.")
    expect(uploads).toEqual([])
    expect(sent).toEqual([{ message: "lunch 50rb", clientDate: "2026-11-25" }])
  })

  it("refuses a file that is not a JPEG, PNG or WebP, and says so", async () => {
    serve()
    await renderApp("/")

    await screen.findByRole("button", { name: "Attach receipt" })
    // As a drop or a picker set to "All files" would deliver it.
    await userEvent
      .setup({ pointerEventsCheck: 0, applyAccept: false })
      .upload(picker(), photo("statement.pdf", "application/pdf"))

    expect(screen.getByRole("alert")).toHaveTextContent("Attach a JPEG, PNG or WebP photo.")
    expect(screen.queryByText("statement.pdf")).toBeNull()
  })

  it("says so when the server refuses the photo, and sends nothing to the model", async () => {
    serve(() => failure(400, "INVALID_RECEIPT"))
    await renderApp("/")

    await attach(photo())
    await userEvent.type(composer(), "this one{Enter}")

    expect(
      await within(log()).findByText("Couldn't read that photo. Attach a JPEG, PNG or WebP."),
    ).toBeInTheDocument()
    expect(sent).toEqual([])
  })

  it("opens the picker from the 'Scan a receipt' suggestion", async () => {
    serve()
    await renderApp("/")
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {})

    await userEvent.click(await screen.findByRole("button", { name: /Scan a receipt/ }))

    expect(click.mock.contexts).toContain(picker())
  })
})
