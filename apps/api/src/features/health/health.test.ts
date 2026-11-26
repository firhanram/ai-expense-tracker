import { describe, expect, it } from "vitest"
import { callApi } from "../../testing/callWorker.ts"
import { readData } from "../../testing/envelope.ts"

describe("GET /api/health", () => {
  it("answers ok when D1 is reachable", async () => {
    const response = await callApi("/api/health")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(await readData(response)).toEqual({ status: "ok" })
  })

  it("is mounted under /api, not at the root", async () => {
    const response = await callApi("/health")

    expect(response.status).toBe(404)
  })

  it("rejects methods the route does not declare", async () => {
    const response = await callApi("/api/health", { method: "POST" })

    expect(response.status).toBe(404)
  })
})
