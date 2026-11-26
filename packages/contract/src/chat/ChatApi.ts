import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { IsoDate, ReceiptKey } from "../expenses/Expense.ts"
import { apiError, errorIdField, ok } from "../ApiResponse.ts"
import { receiptNotFound } from "../receipts/ReceiptsApi.ts"

export const ChatRole = Schema.Literals(["user", "assistant"])
export type ChatRole = typeof ChatRole.Type

/** One bubble in the Chat. */
export const ChatMessage = Schema.Struct({
  id: Schema.String,
  role: ChatRole,
  /** Prose shown in the bubble. */
  content: Schema.String,
  /** Raw OpenUI Lang the assistant wrote; null for user turns and for prose-only replies. */
  uiText: Schema.NullOr(Schema.String),
  /** ISO 8601 UTC. */
  createdAt: Schema.String,
})
export type ChatMessage = typeof ChatMessage.Type

export const SendChatMessage = Schema.Struct({
  message: Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty()),
  /** The user's local date; the server never reads its own clock for dates (ADR-0009). */
  clientDate: IsoDate,
  /** A key from `POST /receipts`: the Receipt image is sent to the model with the message. */
  receiptKey: Schema.optional(ReceiptKey),
})
export type SendChatMessage = typeof SendChatMessage.Type

export const ChatHistoryPageSize = { default: 30, max: 100 } as const

/** A page of the Chat, newest message first. */
export const ChatHistoryPage = Schema.Struct({
  messages: Schema.Array(ChatMessage),
  /** Pass as `before` to load the next, older page; null when this is the oldest. */
  nextBefore: Schema.NullOr(Schema.String),
})
export type ChatHistoryPage = typeof ChatHistoryPage.Type

/**
 * The model could not be reached, or refused the request, before it wrote
 * anything. Distinct from an empty reply, which is a 200 with an empty body.
 * The user message is kept; sending again retries.
 */
export class ModelUnreachable extends Schema.TaggedError<ModelUnreachable>()("ModelUnreachable", {
  /** Why, as the AI layer classified it, e.g. `NetworkError` or `RateLimitError`. */
  reason: Schema.String,
  ...errorIdField,
}) {}

/**
 * The model provider is rate limiting us (it answered 429) before the model
 * wrote anything. The user message is kept; sending again later retries.
 */
export class ModelRateLimited extends Schema.TaggedError<ModelRateLimited>()("ModelRateLimited", {
  ...errorIdField,
}) {}

const modelUnreachable = apiError(
  ModelUnreachable,
  "MODEL_UNREACHABLE",
  () => "The model could not be reached. Send the message again to retry.",
)
const modelRateLimited = apiError(
  ModelRateLimited,
  "TOO_MANY_REQUESTS",
  () => "The model is receiving too many requests. Wait a moment, then send again.",
)

export class ChatGroup extends HttpApiGroup.make("chat").add(
  /**
   * Streams the reply as `text/plain` while the model writes it: the one
   * JSON-less success, so it has no envelope. Fails, enveloped, with
   * `MODEL_UNREACHABLE` (503) or `TOO_MANY_REQUESTS` (429) only if the model
   * fails before the first word, and with `RECEIPT_NOT_FOUND` (404), storing
   * nothing, when `receiptKey` names no stored Receipt.
   */
  HttpApiEndpoint.post("send", "/chat", {
    payload: SendChatMessage,
    success: HttpApiSchema.StreamUint8Array({ contentType: "text/plain; charset=utf-8" }),
    error: [modelUnreachable, modelRateLimited, receiptNotFound],
  }),
  HttpApiEndpoint.get("history", "/chat", {
    query: {
      /** A message id from `nextBefore`: returns messages older than it. */
      before: Schema.optional(Schema.String),
      limit: Schema.optional(
        Schema.NumberFromString.pipe(
          Schema.decodeTo(
            Schema.Int.check(
              Schema.isGreaterThanOrEqualTo(1),
              Schema.isLessThanOrEqualTo(ChatHistoryPageSize.max),
            ),
          ),
        ),
      ),
    },
    success: ok(ChatHistoryPage),
  }),
) {}
