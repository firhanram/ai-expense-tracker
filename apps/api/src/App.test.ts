import { describe, expect, it } from "vitest"
import { callWorker } from "./testing/callWorker.ts"

describe("unknown routes", () => {
  it("return 404", async () => {
    const response = await callWorker("/api/does-not-exist")

    expect(response.status).toBe(404)
  })
})
