import { env } from "cloudflare:workers"

/**
 * Stores an earlier assistant reply that showed `id` as an `ExpenseCard`, so
 * a later turn may show that id again without a tool returning it (the
 * turn's guard against invented ids accepts ids the Chat already showed).
 */
export const shownEarlier = async (id: string) => {
  await env.DB.prepare(
    "INSERT INTO chat_message (id, role, content, ui_text, created_at) VALUES (?, 'assistant', 'Earlier.', ?, '2026-01-01T00:00:00.000Z')",
  )
    .bind(crypto.randomUUID(), `root = Stack([c])\nc = ExpenseCard("${id}")`)
    .run()
}
