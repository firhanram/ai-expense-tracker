import { describe, expect, it } from "vitest"
import { checkProgram, splitReply } from "./index.ts"

const fence = (...lines: ReadonlyArray<string>) => ["```openui-lang", ...lines, "```"].join("\n")

describe("splitting a reply into prose and program", () => {
  it("keeps a prose-only reply as prose, with no program", () => {
    expect(splitReply("You spent Rp70.000 on dining.")).toEqual({
      content: "You spent Rp70.000 on dining.",
      uiText: null,
    })
  })

  it("separates a fenced program from the prose around it", () => {
    const reply = [
      "Here is the draft:",
      "",
      fence("root = Stack([card])", 'card = DraftExpenseCard("exp_1")'),
      "",
      "Press Confirm to record it.",
    ].join("\n")

    expect(splitReply(reply)).toEqual({
      content: "Here is the draft:\n\nPress Confirm to record it.",
      uiText: 'root = Stack([card])\ncard = DraftExpenseCard("exp_1")',
    })
  })

  it("joins the statements of several fenced blocks into one program", () => {
    const reply = ["A", fence("root = Stack([c])"), "B", fence('c = ExpenseCard("x")')].join("\n")

    expect(splitReply(reply)).toEqual({
      content: "A\n\nB",
      uiText: 'root = Stack([c])\nc = ExpenseCard("x")',
    })
  })

  it("keeps a fence the reply was cut off inside", () => {
    const reply = 'Here:\n```openui-lang\nroot = Stack([c])\nc = ExpenseCard("x'

    expect(splitReply(reply)).toEqual({
      content: "Here:",
      uiText: 'root = Stack([c])\nc = ExpenseCard("x',
    })
  })

  it("finds a program the model forgot to fence", () => {
    const reply = ["Your expense:", "root = Stack([c])", 'c = ExpenseCard("x")', "Anything else?"]

    expect(splitReply(reply.join("\n"))).toEqual({
      content: "Your expense:\n\nAnything else?",
      uiText: 'root = Stack([c])\nc = ExpenseCard("x")',
    })
  })

  it("leaves prose that merely contains an equals sign alone", () => {
    expect(splitReply("total = 70rb, right?")).toEqual({
      content: "total = 70rb, right?",
      uiText: null,
    })
  })

  it("has empty prose when the reply is only a program", () => {
    expect(splitReply(fence('root = Stack([ExpenseCard("x")])'))).toEqual({
      content: "",
      uiText: 'root = Stack([ExpenseCard("x")])',
    })
  })
})

describe("checking a program", () => {
  it("passes a program whose every statement fits the library", () => {
    const check = checkProgram(fence("root = Stack([c])", 'c = ExpenseCard("x")'))

    expect(check.outcome).toBe("ok")
    expect(check.problems).toEqual([])
  })

  it("calls a reply with no statements prose, not a failure", () => {
    expect(checkProgram("You spent Rp70.000.").outcome).toBe("prose")
  })

  it("fails a program with no root", () => {
    expect(checkProgram('card = DraftExpenseCard("e1")').outcome).toBe("no-root")
  })

  it("fails a program that references a name it never defines", () => {
    const check = checkProgram('root = Stack([a, b])\na = ExpenseCard("x")')

    expect(check.outcome).toBe("reference-graph")
    expect(check.problems).toContain("unresolved reference: b")
  })

  it("fails a program that defines a name root never reaches", () => {
    const check = checkProgram('root = Stack([a])\na = ExpenseCard("x")\nb = ExpenseCard("y")')

    expect(check.outcome).toBe("reference-graph")
    expect(check.problems).toContain("orphaned statement: b")
  })

  it("fails a child the parser silently dropped for a bad argument", () => {
    const check = checkProgram(
      'root = Stack([c])\nc = SpendingChart("2026-01-01", "2026-01-31", "week", "bar")',
    )

    expect(check.outcome).toBe("type-mismatch")
    expect(check.problems[0]).toMatch(/groupBy/)
  })

  it.each([
    ["an unknown component", 'root = Stack([c])\nc = Receipt("x")'],
    ["a missing argument", "root = Stack([c])\nc = DraftExpenseCard()"],
    ["an extra argument", 'root = Stack([c])\nc = ExpenseCard("x", 70000)'],
  ])("fails %s as a type mismatch", (_, program) => {
    expect(checkProgram(program).outcome).toBe("type-mismatch")
  })

  it("fails a program the model stopped writing midway", () => {
    expect(checkProgram('root = Stack([c])\nc = ExpenseCard("x').outcome).toBe("truncation")
  })

  it("fails a complete-looking program when the model hit its output limit", () => {
    const program = fence("root = Stack([c])", 'c = ExpenseCard("x")')

    expect(checkProgram(program, { finishReason: "length" }).outcome).toBe("truncation")
  })
})
