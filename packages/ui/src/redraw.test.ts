import { describe, expect, it } from "vitest"
import { checkProgram, componentSignatures, components } from "./index.ts"
import { checkRedraw } from "./redraw.ts"

const original = [
  "root = Stack([card, list, gone])",
  'card = ExpenseCard("exp_1")',
  'list = ExpenseList("confirmed", "2026-11-01", "2026-11-30", 6)',
].join("\n")

const drawable = [
  'root = Stack([card])\ncard = ExpenseCard("exp_1")',
  'root = Stack([ExpenseCard("exp_1"), DraftExpenseCard("exp_1")])',
  'root = Stack([list])\nlist = ExpenseList("confirmed", "2026-11-01", "2026-11-30", 6)',
  'root = Stack([chart])\nchart = SpendingChart("2026-01-01", "2026-11-30", "month", "bar")',
  'root = Stack([ExpenseList("draft")])',
]

const broken = [
  'root = Stack([card, gone])\ncard = ExpenseCard("exp_1")',
  'root = Stack([card]\ncard = ExpenseCard("exp_1")',
  'card = ExpenseCard("exp_1")',
  'root = Stack([card])\ncard = Chart("exp_1")',
  "root = Stack([card])\ncard = ExpenseCard()",
  'root = Stack([chart])\nchart = SpendingChart("2026-01-01")',
]

describe("checkRedraw (S3)", () => {
  it.each(drawable)("passes what the library's check passes: %s", (program) => {
    expect(checkProgram(program).outcome).toBe("ok")
    expect(checkRedraw(program, original)).toEqual([])
  })

  it.each(broken)("refuses what the library's check refuses: %s", (program) => {
    expect(checkProgram(program).outcome).not.toBe("ok")
    expect(checkRedraw(program, original)).not.toEqual([])
  })

  it("refuses an empty Stack, which draws nothing", () => {
    expect(checkRedraw("root = Stack([])", original)).toEqual(["nothing to draw"])
  })

  it("refuses an id the original reply did not have", () => {
    expect(checkRedraw('root = Stack([ExpenseCard("exp_2")])', original)).toEqual([
      'invented id: "exp_2"',
    ])
    expect(
      checkRedraw(
        'root = Stack([ExpenseList("confirmed", "2026-11-01", "2026-11-30", 7)])',
        original,
      ),
    ).toEqual(["invented id: 7"])
  })

  it("knows every component Stack can hold, with the library's argument counts", () => {
    const library = Object.fromEntries(
      components
        .filter((component) => component.name !== "Stack")
        .map((component) => {
          const shape = component.props.shape as Record<string, { isOptional(): boolean }>
          const keys = Object.values(shape)
          return [
            component.name,
            { min: keys.filter((key) => !key.isOptional()).length, max: keys.length },
          ]
        }),
    )
    expect(
      Object.fromEntries(
        Object.entries(componentSignatures).map(([name, { min, max }]) => [name, { min, max }]),
      ),
    ).toEqual(library)
  })
})
