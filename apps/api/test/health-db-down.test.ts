import { describe, expect, it } from "vitest"
import { makeHandler } from "../src/App.ts"

// Regression: health must reflect D1, not answer "ok" unconditionally.
const unreachable = (): never => {
  throw new Error("D1 unreachable")
}
const unreachableDb: D1Database = {
  prepare: unreachable,
  batch: unreachable,
  exec: unreachable,
  withSession: unreachable,
  dump: unreachable,
}

describe("GET /api/health with D1 down", () => {
  it("fails with a 500 problem instead of reporting ok", async () => {
    const app = makeHandler({ DB: unreachableDb })
    try {
      const response = await app.handler(new Request("http://localhost/api/health"), undefined)

      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('"ok"')
    } finally {
      await app.dispose()
    }
  })
})
