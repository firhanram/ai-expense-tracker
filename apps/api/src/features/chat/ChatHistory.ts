import { type ChatHistoryPage, type ChatMessage, ChatRole } from "@expense/contract"
import { Effect, Option, Schema } from "effect"
import { SqlClient, SqlSchema } from "effect/sql"

const Row = Schema.Struct({
  id: Schema.String,
  role: ChatRole,
  content: Schema.String,
  ui_text: Schema.NullOr(Schema.String),
  created_at: Schema.String,
})

const toMessage = (row: typeof Row.Type): ChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  uiText: row.ui_text,
  createdAt: row.created_at,
})

export interface NewChatMessage {
  /** Made here when absent; a turn picks its reply's id up front so the client can be told it. */
  readonly id?: string | undefined
  readonly role: ChatRole
  readonly content: string
  readonly uiText?: string | null | undefined
}

/**
 * The one continuous Chat, stored in `chat_message`. Order is insertion
 * order (SQLite's `rowid`), not `created_at`: a user message and its reply
 * can share a millisecond, and the Chat must not reorder them.
 */
export const makeChatHistory = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const newestFirst = SqlSchema.findAll({
    Request: Schema.Struct({ before: Schema.NullOr(Schema.String), limit: Schema.Int }),
    Result: Row,
    execute: ({ before, limit }) => sql`
      SELECT id, role, content, ui_text, created_at FROM chat_message
      WHERE ${before === null ? sql`1 = 1` : sql`rowid < (SELECT rowid FROM chat_message WHERE id = ${before})`}
      ORDER BY rowid DESC
      LIMIT ${limit}`,
  })

  const append = (message: NewChatMessage) =>
    sql`INSERT INTO chat_message ${sql.insert({
      id: message.id ?? crypto.randomUUID(),
      role: message.role,
      content: message.content,
      ui_text: message.uiText ?? null,
      created_at: new Date().toISOString(),
    })}`.pipe(Effect.asVoid, Effect.orDie)

  /** One page, newest first. An unknown `before` id yields an empty page. */
  const page = (options: { readonly before?: string | undefined; readonly limit: number }) =>
    newestFirst({ before: options.before ?? null, limit: options.limit + 1 }).pipe(
      Effect.map((rows): ChatHistoryPage => {
        const messages = rows.slice(0, options.limit).map(toMessage)
        const hasOlder = rows.length > options.limit
        return { messages, nextBefore: hasOlder ? (messages.at(-1)?.id ?? null) : null }
      }),
      Effect.orDie,
    )

  /** The last `count` messages, oldest first, as the model reads a conversation. */
  const recent = (count: number) =>
    newestFirst({ before: null, limit: count }).pipe(
      Effect.map((rows) => rows.map(toMessage).toReversed()),
      Effect.orDie,
    )

  const byId = SqlSchema.findOneOption({
    Request: Schema.String,
    Result: Row,
    execute: (id) => sql`
      SELECT id, role, content, ui_text, created_at FROM chat_message WHERE id = ${id}`,
  })

  /** One message by id, if the Chat has it. */
  const find = (id: string) =>
    byId(id).pipe(
      Effect.map((row) => row.pipe(Option.map(toMessage))),
      Effect.orDie,
    )

  /** Replaces one message's program, keeping its prose and its place. */
  const setUiText = (id: string, uiText: string | null) =>
    sql`UPDATE chat_message SET ui_text = ${uiText} WHERE id = ${id}`.pipe(
      Effect.asVoid,
      Effect.orDie,
    )

  return { append, find, page, recent, setUiText } as const
})
