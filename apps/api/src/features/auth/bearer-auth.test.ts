import { describe, expect, it } from "vitest"
import { callApi, callWorker } from "../../testing/callWorker.ts"

// Any path other than health stands in for a protected route; none exist yet.
const protectedPath = "/api/expenses"

describe("bearer token", () => {
  it("rejects a request without a token", async () => {
    const response = await callWorker(protectedPath)

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toBe("Bearer")
  })

  it("rejects a wrong token", async () => {
    const response = await callWorker(protectedPath, {
      headers: { authorization: "Bearer not-the-token" },
    })

    expect(response.status).toBe(401)
  })

  it("lets the right token through to the router", async () => {
    const response = await callApi("/api/does-not-exist")

    expect(response.status).toBe(404)
  })

  it("leaves health open", async () => {
    const response = await callWorker("/api/health")

    expect(response.status).toBe(200)
  })
})
