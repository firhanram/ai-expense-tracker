import { env } from "cloudflare:workers"
import { Context, type Layer } from "effect"
import type { LanguageModel } from "effect/ai"
import { makeHandler } from "../App.ts"
import { WaitUntil } from "../WaitUntil.ts"
import { deployedOrigin, withAccessToken } from "./callWorker.ts"

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
    const response = await app.handler(
      new Request(`${deployedOrigin}${path}`, await withAccessToken(init)),
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

/**
 * `POST /api/chat` from a client that leaves mid-reply: it reads the first
 * chunk, then aborts and stops reading. `onLeft` runs once it has gone, so a
 * fake model can be held until then. Resolves once the work the turn handed
 * to `waitUntil` has settled, as the Worker would wait for it.
 */
export const sendChatAndLeave = async (
  languageModel: Layer.Layer<LanguageModel.LanguageModel>,
  body: Record<string, unknown>,
  onLeft: () => void,
) => {
  const app = makeHandler(env, { languageModel })
  const background: Array<Promise<unknown>> = []
  const abort = new AbortController()
  try {
    const response = await app.handler(
      new Request(
        `${deployedOrigin}/api/chat`,
        await withAccessToken({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: abort.signal,
        }),
      ),
      Context.make(WaitUntil, (promise) => background.push(promise)),
    )
    const reader = response.body!.getReader()
    const first = await reader.read()
    abort.abort()
    await reader.cancel()
    onLeft()
    await Promise.all(background)
    return { status: response.status, firstChunk: new TextDecoder().decode(first.value) }
  } finally {
    await app.dispose()
  }
}
