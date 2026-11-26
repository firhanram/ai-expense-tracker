import { describe, expect, it } from "vitest"
import { toLocalIsoDate } from "./localDate.ts"

// vite.config.ts runs the tests in Asia/Jakarta (UTC+7), where UTC and local dates differ.
describe("toLocalIsoDate", () => {
  it("is the date on the user's clock, not in UTC (ADR-0009)", () => {
    expect(toLocalIsoDate(new Date("2026-11-24T20:30:00Z"))).toBe("2026-11-25")
    expect(toLocalIsoDate(new Date("2026-11-30T16:59:00Z"))).toBe("2026-11-30")
  })

  it("pads single-digit months and days", () => {
    expect(toLocalIsoDate(new Date("2026-01-04T05:00:00Z"))).toBe("2026-01-04")
  })
})
