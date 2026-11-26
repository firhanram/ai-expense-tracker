import type { SendChatMessage } from "@expense/contract"
import { Data, Option, Schema } from "effect"

/**
 * Why a send got no reply. `network`: no answer at all; the others name the
 * envelope's `errorCode` (`MODEL_UNREACHABLE`, `TOO_MANY_REQUESTS`, ...).
 */
export type SendChatFailureReason =
  | "model-unreachable"
  | "rate-limited"
  | "unauthorized"
  | "receipt-not-found"
  | "network"
  | "failed"

export class SendChatFailure extends Data.TaggedError("SendChatFailure")<{
  readonly reason: SendChatFailureReason
}> {}

const reasonFor: Readonly<Record<string, SendChatFailureReason>> = {
  MODEL_UNREACHABLE: "model-unreachable",
  TOO_MANY_REQUESTS: "rate-limited",
  UNAUTHORIZED: "unauthorized",
  RECEIPT_NOT_FOUND: "receipt-not-found",
}

const FailureEnvelope = Schema.Struct({ error: Schema.Struct({ errorCode: Schema.String }) })
const decodeFailure = Schema.decodeUnknownOption(FailureEnvelope)

const failureOf = async (response: Response): Promise<SendChatFailure> => {
  const body: unknown = await response.json().catch(() => null)
  const code = Option.map(decodeFailure(body), (envelope) => envelope.error.errorCode)
  return new SendChatFailure({
    reason: Option.getOrUndefined(Option.flatMapNullishOr(code, (c) => reasonFor[c])) ?? "failed",
  })
}

async function* decode(body: ReadableStream<Uint8Array> | null): AsyncGenerator<string> {
  if (body === null) return
  const reader = body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- a stream is read one chunk after another.
      const { done, value } = await reader.read()
      const text = decoder.decode(value, { stream: !done })
      if (text.length > 0) yield text
      if (done) return
    }
  } finally {
    reader.releaseLock()
  }
}

export interface SendChatOptions {
  readonly baseUrl: string
  readonly token?: string | undefined
  readonly fetch: typeof globalThis.fetch
}

/**
 * `POST /api/chat` with a plain `fetch`, since the typed client cannot stream.
 * Resolves once the reply starts, with its text as it arrives; rejects with a
 * `SendChatFailure` when the request fails before the first word. A failure
 * after it surfaces as the iterator throwing.
 */
export type SendChat = (request: SendChatMessage) => Promise<AsyncIterable<string>>

export const createSendChat =
  (options: SendChatOptions): SendChat =>
  async (request) => {
    const headers = new Headers({ "content-type": "application/json" })
    if (options.token !== undefined && options.token !== "") {
      headers.set("authorization", `Bearer ${options.token}`)
    }
    const response = await options
      .fetch(new URL("/api/chat", options.baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      })
      .catch(() => {
        throw new SendChatFailure({ reason: "network" })
      })
    if (!response.ok) throw await failureOf(response)
    return decode(response.body)
  }
