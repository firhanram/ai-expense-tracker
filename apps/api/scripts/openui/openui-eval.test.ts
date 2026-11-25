import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import {
  scriptedLanguageModel,
  textReply,
  unreachable,
} from "../../src/testing/FakeLanguageModel.ts"
import { type EvalCase, formatReport, gradeReply, runEval } from "./OpenUiEval.ts"

const fence = (...lines: ReadonlyArray<string>) => ["```openui-lang", ...lines, "```"].join("\n")

const draftCase: EvalCase = {
  name: "draft",
  expect: "ui",
  message: "beli baju 70rb",
  context: 'propose_expense returned {"id":"exp_1"}',
  ids: ["exp_1"],
}
const questionCase: EvalCase = { name: "question", expect: "prose", message: "what is a draft?" }
const eitherCase: EvalCase = { name: "either", expect: "either", message: "spent last month?" }

describe("grading one generation", () => {
  it("passes a UI case whose program is valid and uses the ids it was given", () => {
    const grade = gradeReply(draftCase, {
      text: fence("root = Stack([c])", 'c = DraftExpenseCard("exp_1")'),
      finishReason: "stop",
    })

    expect(grade).toMatchObject({ outcome: "ok", passed: true })
  })

  it("fails a UI case answered in prose", () => {
    const grade = gradeReply(draftCase, { text: "Noted!", finishReason: "stop" })

    expect(grade).toMatchObject({ outcome: "prose-instead-of-ui", passed: false })
  })

  it("fails a program that shows an id no tool returned (ADR-0001)", () => {
    const grade = gradeReply(draftCase, {
      text: fence('root = Stack([DraftExpenseCard("exp_999")])'),
      finishReason: "stop",
    })

    expect(grade).toMatchObject({ outcome: "invented-id", passed: false })
  })

  it("fails a prose case that renders a component anyway", () => {
    const grade = gradeReply(questionCase, {
      text: fence('root = Stack([ExpenseList("draft")])'),
      finishReason: "stop",
    })

    expect(grade).toMatchObject({ outcome: "forced-ui", passed: false })
  })

  it("accepts prose or valid UI where either answers the question", () => {
    expect(gradeReply(eitherCase, { text: "Rp1.200.000.", finishReason: "stop" }).passed).toBe(true)
    const chart = fence(
      'root = Stack([SpendingChart("2026-10-01", "2026-10-31", "category", "bar")])',
    )
    expect(gradeReply(eitherCase, { text: chart, finishReason: "stop" }).passed).toBe(true)
  })

  it("reports the program's failure mode whatever the case expected", () => {
    const grade = gradeReply(eitherCase, {
      text: fence('card = ExpenseCard("x")'),
      finishReason: "stop",
    })

    expect(grade).toMatchObject({ outcome: "no-root", passed: false })
  })
})

describe("the eval run", () => {
  it("cycles the cases for the requested generations and tallies the outcomes", async () => {
    const model = scriptedLanguageModel(
      textReply(fence('root = Stack([DraftExpenseCard("exp_1")])')),
      textReply("A Draft is an unconfirmed Expense."),
      textReply(fence('root = Stack([c])\nc = SpendingChart("a", "b", "week", "bar")')),
      textReply("Noted."),
    )

    const report = await runEval({
      cases: [draftCase, questionCase, eitherCase],
      generations: 4,
      concurrency: 1,
    }).pipe(Effect.provide(model.layer), Effect.runPromise)

    expect(report.results.map((result) => [result.case, result.outcome])).toEqual([
      ["draft", "ok"],
      ["question", "prose"],
      ["either", "type-mismatch"],
      ["draft", "prose-instead-of-ui"],
    ])
    expect(report.passed).toBe(2)
    expect(model.calls[0]!.prompt.content.at(-2)).toMatchObject({
      role: "system",
      content: expect.stringContaining('propose_expense returned {"id":"exp_1"}'),
    })
  })

  it("counts a model error as a failed generation rather than ending the run", async () => {
    const model = scriptedLanguageModel(unreachable(), textReply("Hello."))

    const report = await runEval({ cases: [questionCase], generations: 2, concurrency: 1 }).pipe(
      Effect.provide(model.layer),
      Effect.runPromise,
    )

    expect(report.results.map((result) => result.outcome)).toEqual(["model-error", "prose"])
    expect(report.passed).toBe(1)
  })

  it("formats a pass rate and a failure-mode breakdown", () => {
    const markdown = formatReport({
      model: "deepseek/deepseek-flash",
      ranAt: "2026-11-25T00:00:00.000Z",
      generations: 4,
      passed: 3,
      results: [
        { case: "draft", outcome: "ok", passed: true, problems: [], text: "" },
        { case: "draft", outcome: "ok", passed: true, problems: [], text: "" },
        { case: "question", outcome: "prose", passed: true, problems: [], text: "" },
        { case: "either", outcome: "truncation", passed: false, problems: ["cut"], text: "x" },
      ],
    })

    expect(markdown).toContain("**Pass rate: 75.0%** (3 of 4)")
    expect(markdown).toMatch(/\| truncation \| 1 \|/)
    expect(markdown).toMatch(/\| no-root \| 0 \|/)
  })
})
