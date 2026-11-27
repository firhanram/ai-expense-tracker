import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

// No route reads categories yet, so the migrated database is the seam here.
describe("D1 migrations", () => {
  it("seed the twelve Categories in ADR-0004 order", async () => {
    const { results } = await env.DB.prepare(
      "SELECT id, name FROM category ORDER BY sort_order",
    ).all()

    expect(results).toEqual([
      { id: 1, name: "Groceries" },
      { id: 2, name: "Dining" },
      { id: 3, name: "Transport" },
      { id: 4, name: "Utilities" },
      { id: 5, name: "Housing" },
      { id: 6, name: "Shopping" },
      { id: 7, name: "Health" },
      { id: 8, name: "Entertainment" },
      { id: 9, name: "Education" },
      { id: 10, name: "Giving & family" },
      { id: 12, name: "Pets" },
      { id: 11, name: "Other" },
    ])
  })
})
