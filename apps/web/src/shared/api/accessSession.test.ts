import { describe, expect, it, vi } from "vitest"
import { reloadWhenSignedOut } from "./accessSession.ts"
import { createApi } from "./client.ts"

/**
 * What `fetch(…, { redirect: "manual" })` resolves with when Access answers
 * an expired session with a redirect to its login page. Not constructible
 * with `new Response`, so it is spelled out.
 */
const accessRedirect = (): Response =>
  Object.defineProperties(new Response(null, { status: 200 }), {
    type: { value: "opaqueredirect" },
    status: { value: 0 },
    ok: { value: false },
  })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

/** Settles with "pending" if `promise` has not settled after the current tasks run. */
const stateOf = async (promise: Promise<unknown>) =>
  Promise.race([
    promise.then(
      () => "resolved",
      () => "rejected",
    ),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
  ])

describe("an expired Access session", () => {
  it("asks fetch not to follow redirects, so Access's login redirect stays visible", async () => {
    const sent: Array<RequestInit | undefined> = []
    const fetch = reloadWhenSignedOut(async (_input, init) => {
      sent.push(init)
      return json({ success: true, data: { status: "ok" } })
    }, vi.fn<() => void>())

    await fetch("http://app.test/api/health", { method: "GET" })

    expect(sent[0]).toMatchObject({ method: "GET", redirect: "manual" })
  })

  it("reloads the page instead of answering, so the owner lands on the login screen", async () => {
    const reload = vi.fn<() => void>()
    const api = createApi({
      baseUrl: "http://app.test",
      fetch: reloadWhenSignedOut(async () => accessRedirect(), reload),
    })

    const call = api((client) => client.expenses.list({ query: {} }))

    expect(await stateOf(call)).toBe("pending")
    expect(reload).toHaveBeenCalledOnce()
  })

  it("passes a real answer through untouched, errors included", async () => {
    const reload = vi.fn<() => void>()
    const api = createApi({
      baseUrl: "http://app.test",
      fetch: reloadWhenSignedOut(
        async () =>
          json(
            {
              success: false,
              error: { errorId: "e", errorCode: "UNAUTHORIZED", message: "No token." },
            },
            401,
          ),
        reload,
      ),
    })

    await expect(api((client) => client.expenses.list({ query: {} }))).rejects.toMatchObject({
      _tag: "Unauthorized",
    })
    expect(reload).not.toHaveBeenCalled()
  })

  it("leaves a network failure a network failure", async () => {
    const reload = vi.fn<() => void>()
    const fetch = reloadWhenSignedOut(async () => {
      throw new TypeError("Failed to fetch")
    }, reload)

    await expect(fetch("http://app.test/api/chat")).rejects.toThrow(TypeError)
    expect(reload).not.toHaveBeenCalled()
  })
})
