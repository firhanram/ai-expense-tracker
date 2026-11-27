import { describe, expect, it } from "vitest"
import { parseAmount } from "./amount.ts"

describe("parseAmount", () => {
  it.each([
    ["70000", 70000],
    ["70.000", 70000],
    ["-70.000", -70000],
    ["−70.000", -70000],
    ["56rb", 56000],
    ["56 rb", 56000],
    ["56K", 56000],
    ["1,5jt", 1500000],
    ["1.5k", 1500],
    ["-20rb", -20000],
  ])("reads %s as %i", (typed, amount) => {
    expect(parseAmount(typed)).toEqual({ amount })
  })

  it.each(["", "70,5", "0,0005k", "abc", "5rbx"])("refuses %j", (typed) => {
    expect(parseAmount(typed)).toHaveProperty("error")
  })
})
