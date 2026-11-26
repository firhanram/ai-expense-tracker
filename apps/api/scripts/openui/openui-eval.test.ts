import { Effect, Schema } from "effect"
import type { Prompt } from "effect/ai"
import { describe, expect, it } from "vitest"
import {
  scriptedLanguageModel,
  textReply,
  toolCallReply,
  toolResultsIn,
  unreachable,
} from "../../src/testing/FakeLanguageModel.ts"
import { type EvalCase, formatReport, gradeReply, runEval } from "./OpenUiEval.ts"

const fence = (...lines: ReadonlyArray<string>) => ["```openui-lang", ...lines, "```"].join("\n")

const draftCase: EvalCase = { name: "draft", expect: "ui", message: "beli baju 70rb" }
const questionCase: EvalCase = { name: "question", expect: "prose", message: "what is a draft?" }
const eitherCase: EvalCase = { name: "either", expect: "either", message: "spent last month?" }
const showCase: EvalCase = {
  name: "show",
  expect: "ui",
  message: "show me that coffee again",
  ledger: [
    {
      id: "exp_coffee",
      status: "confirmed",
      amount: 28000,
      categoryName: "Dining",
      merchant: "Kopi Kenangan",
      note: null,
      occurredAt: "2026-11-24",
      needsReview: false,
    },
  ],
}

/** Grades `text` as a reply that stopped normally, with `knownIds` the Expenses that exist. */
const grade = (evalCase: EvalCase, text: string, knownIds: ReadonlyArray<string> = []) =>
  gradeReply(evalCase, { text, finishReason: "stop", knownIds })

describe("grading one generation", () => {
  it("passes a UI case whose program is valid and uses ids that exist", () => {
    const result = grade(draftCase, fence("root = Stack([c])", 'c = DraftExpenseCard("exp_1")'), [
      "exp_1",
    ])

    expect(result).toMatchObject({ outcome: "ok", passed: true })
  })

  it("fails a UI case answered in prose", () => {
    expect(grade(draftCase, "Noted!")).toMatchObject({
      outcome: "prose-instead-of-ui",
      passed: false,
    })
  })

  it("fails a program that shows an id no tool returned (ADR-0001)", () => {
    const result = grade(draftCase, fence('root = Stack([DraftExpenseCard("exp_999")])'), ["exp_1"])

    expect(result).toMatchObject({ outcome: "invented-id", passed: false })
  })

  it("fails a prose case that renders a component anyway", () => {
    const result = grade(questionCase, fence('root = Stack([ExpenseList("draft")])'))

    expect(result).toMatchObject({ outcome: "forced-ui", passed: false })
  })

  it("accepts prose or valid UI where either answers the question", () => {
    expect(grade(eitherCase, "Rp1.200.000.").passed).toBe(true)
    const chart = fence(
      'root = Stack([SpendingChart("2026-10-01", "2026-10-31", "category", "bar")])',
    )
    expect(grade(eitherCase, chart).passed).toBe(true)
  })

  it("reports the program's failure mode whatever the case expected", () => {
    expect(grade(eitherCase, fence('card = ExpenseCard("x")'))).toMatchObject({
      outcome: "no-root",
      passed: false,
    })
  })
})

/** Ids of the Drafts `propose_expense` returned so far this turn. */
const proposedIds = (prompt: Prompt.Prompt) =>
  toolResultsIn(prompt).flatMap((result) =>
    result.name === "propose_expense" && !result.isFailure
      ? [Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))(result.result).id]
      : [],
  )

describe("the eval run", () => {
  it("runs the real tool-calling turn, the tools answering from the case's ledger", async () => {
    const model = scriptedLanguageModel(
      toolCallReply("propose_expense", {
        amount: 70000,
        merchant: null,
        categoryName: "Shopping",
        note: null,
        needsReview: false,
      }),
      (prompt) => textReply(fence(`root = Stack([DraftExpenseCard("${proposedIds(prompt)[0]}")])`)),
      toolCallReply("get_expense", { id: "exp_coffee" }),
      textReply(fence('root = Stack([ExpenseCard("exp_coffee")])')),
    )

    const report = await runEval({
      cases: [draftCase, showCase],
      generations: 2,
      concurrency: 1,
    }).pipe(Effect.provide(model.layer), Effect.runPromise)

    expect(report.results.map((result) => [result.case, result.outcome])).toEqual([
      ["draft", "ok"],
      ["show", "ok"],
    ])
    expect(model.calls[0]!.toolNames).toEqual(
      expect.arrayContaining(["search_categories", "propose_expense", "query_spending"]),
    )
    expect(toolResultsIn(model.calls[3]!.prompt)).toMatchObject([
      {
        name: "get_expense",
        isFailure: false,
        result: { id: "exp_coffee", merchant: "Kopi Kenangan" },
      },
    ])
  })

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
      ["draft", "invented-id"],
      ["question", "prose"],
      ["either", "type-mismatch"],
      ["draft", "prose-instead-of-ui"],
    ])
    expect(report.passed).toBe(1)
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
