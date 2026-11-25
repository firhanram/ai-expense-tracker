import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

/** A calendar date with no time, `YYYY-MM-DD` (ADR-0009). */
export const IsoDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))

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
  receiptKey: Schema.optional(Schema.String),
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
export class ModelUnreachable extends Schema.TaggedError<ModelUnreachable>()(
  "ModelUnreachable",
  {
    /** Why, as the AI layer classified it, e.g. `NetworkError` or `RateLimitError`. */
    reason: Schema.String,
  },
  { httpApiStatus: 503 },
) {}

export class ChatGroup extends HttpApiGroup.make("chat").add(
  /**
   * Streams the reply as `text/plain` while the model writes it. Fails with
   * `ModelUnreachable` (503) only if the model fails before the first word.
   */
  HttpApiEndpoint.post("send", "/chat", {
    payload: SendChatMessage,
    success: HttpApiSchema.StreamUint8Array({ contentType: "text/plain; charset=utf-8" }),
    error: ModelUnreachable,
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
    success: ChatHistoryPage,
  }),
) {}
