import { env } from "cloudflare:workers"
import { Context, type Layer } from "effect"
import type { LanguageModel } from "effect/ai"
import { makeHandler } from "../App.ts"

/**
 * S1 with the S2 model swapped in: the real app against the local D1, but
 * the `LanguageModel` is the one the test supplies. The body is read before
 * the app is disposed, so a streamed reply arrives whole.
 */
export const callApiWithModel = async (
  languageModel: Layer.Layer<LanguageModel.LanguageModel>,
  path: string,
  init?: RequestInit,
) => {
  const app = makeHandler(env, { languageModel })
  try {
    const headers = new Headers(init?.headers)
    headers.set("authorization", `Bearer ${env.API_TOKEN}`)
    const response = await app.handler(
      new Request(`http://localhost${path}`, { ...init, headers }),
      Context.empty(),
    )
    const body = await response.text()
    return { status: response.status, headers: response.headers, body }
  } finally {
    await app.dispose()
  }
}

/** `POST /api/chat` with a JSON body. */
export const sendChat = (
  languageModel: Layer.Layer<LanguageModel.LanguageModel>,
  body: Record<string, unknown>,
) =>
  callApiWithModel(languageModel, "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
