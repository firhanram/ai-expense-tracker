import { describe, expect, it } from "vitest"
import { createSendChat, SendChatFailure } from "./sendChat.ts"

const textStream = (...chunks: ReadonlyArray<string>) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })

const envelope = (status: number, errorCode: string) =>
  new Response(
    JSON.stringify({ success: false, error: { errorId: "x", errorCode, message: errorCode } }),
    { status, headers: { "content-type": "application/json" } },
  )

const collect = async (chunks: AsyncIterable<string>) => {
  let text = ""
  for await (const chunk of chunks) text += chunk
  return text
}

describe("sending a chat message", () => {
  it("posts the message and yields the reply as it streams", async () => {
    const sent: Array<Request> = []
    const send = createSendChat({
      baseUrl: "http://app.test",
      fetch: async (input, init) => {
        sent.push(new Request(input, init))
        return new Response(textStream("You spent ", "Rp70.000."), { status: 200 })
      },
    })

    const reply = await send({ message: "how much?", clientDate: "2026-11-25" })

    expect(await collect(reply)).toBe("You spent Rp70.000.")
    const request = sent[0]
    expect(request?.url).toBe("http://app.test/api/chat")
    expect(request?.method).toBe("POST")
    expect(request?.headers.get("authorization")).toBeNull()
    expect(await request?.json()).toEqual({ message: "how much?", clientDate: "2026-11-25" })
  })

  it.each([
    [503, "MODEL_UNREACHABLE", "model-unreachable"],
    [429, "TOO_MANY_REQUESTS", "rate-limited"],
    [401, "UNAUTHORIZED", "unauthorized"],
    [404, "RECEIPT_NOT_FOUND", "receipt-not-found"],
    [500, "INTERNAL", "failed"],
  ] as const)("rejects a %i %s envelope as %s", async (status, code, reason) => {
    const send = createSendChat({
      baseUrl: "http://app.test",
      fetch: async () => envelope(status, code),
    })

    await expect(send({ message: "hi", clientDate: "2026-11-25" })).rejects.toEqual(
      new SendChatFailure({ reason }),
    )
  })

  it("rejects as unreachable when the request never gets an answer", async () => {
    const send = createSendChat({
      baseUrl: "http://app.test",
      fetch: async () => {
        throw new TypeError("Failed to fetch")
      },
    })

    await expect(send({ message: "hi", clientDate: "2026-11-25" })).rejects.toEqual(
      new SendChatFailure({ reason: "network" }),
    )
  })
})
