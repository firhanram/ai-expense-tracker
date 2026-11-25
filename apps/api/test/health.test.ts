import { describe, expect, it } from "vitest"
import worker from "../src/index.ts"

// S1 seam: the Worker's fetch handler runs in workerd against a local D1.
// No socket, no deploy.
const call = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://localhost${path}`, init))

describe("GET /api/health", () => {
  it("answers ok when D1 is reachable", async () => {
    const response = await call("/api/health")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(await response.json()).toEqual({ status: "ok" })
  })

  it("is mounted under /api, not at the root", async () => {
    const response = await call("/health")

    expect(response.status).toBe(404)
  })

  it("rejects methods the route does not declare", async () => {
    const response = await call("/api/health", { method: "POST" })

    expect(response.status).toBe(404)
  })
})

describe("unknown routes", () => {
  it("return 404", async () => {
    const response = await call("/api/does-not-exist")

    expect(response.status).toBe(404)
  })
})
