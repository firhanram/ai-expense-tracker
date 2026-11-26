import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import { makeHandler } from "../../App.ts"

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
    const app = makeHandler({
      DB: unreachableDb,
      // Health reads only D1.
      RECEIPTS: env.RECEIPTS,
      API_TOKEN: "unused-health-is-public",
      API_PROVIDER_KEY: "unused-no-model-call",
    })
    try {
      const response = await app.handler(new Request("http://localhost/api/health"), undefined)

      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('"ok"')
    } finally {
      await app.dispose()
    }
  })
})
