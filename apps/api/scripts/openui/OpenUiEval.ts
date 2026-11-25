import {
  checkProgram,
  type ElementNode,
  isElementNode,
  parseProgram,
  systemPrompt,
} from "@expense/ui"
import { Effect, Layer, Stream } from "effect"
import { LanguageModel, type Prompt, type Response } from "effect/ai"
import { runAgentLoop } from "../../src/features/chat/AgentLoop.ts"
import { buildPrompt } from "../../src/features/chat/ChatTurn.ts"
import type { ModelProviderConfig } from "../../src/features/chat/ModelProvider.ts"

/**
 * The OpenUI Lang eval (ADR-0008: "build a small eval against the real
 * component library before wiring the UI"). Each generation is one Chat turn
 * as the app sends it, the same system prompt and prompt shape, graded by
 * `checkProgram` from `@expense/ui`.
 */

/** One scenario. `context` stands in for the tool results the model would have read this turn. */
export interface EvalCase {
  readonly name: string
  /** `ui`: must answer with a valid program. `prose`: must not. `either`: valid program or prose. */
  readonly expect: "ui" | "prose" | "either"
  readonly message: string
  readonly context?: string | undefined
  /** The only Expense ids the reply may show; any other is invented. */
  readonly ids?: ReadonlyArray<string> | undefined
}

export type EvalOutcome =
  | "ok"
  | "prose"
  | "no-root"
  | "reference-graph"
  | "type-mismatch"
  | "truncation"
  | "invented-id"
  | "prose-instead-of-ui"
  | "forced-ui"
  | "model-error"

/** Every outcome, in report order. */
export const evalOutcomes: ReadonlyArray<EvalOutcome> = [
  "ok",
  "prose",
  "no-root",
  "reference-graph",
  "type-mismatch",
  "truncation",
  "invented-id",
  "prose-instead-of-ui",
  "forced-ui",
  "model-error",
]

export interface EvalResult {
  readonly case: string
  readonly outcome: EvalOutcome
  readonly passed: boolean
  readonly problems: ReadonlyArray<string>
  /** What the model wrote, for reading failures. */
  readonly text: string
}

export interface EvalReport {
  readonly generations: number
  readonly passed: number
  readonly results: ReadonlyArray<EvalResult>
}

/** The client date every case runs on, so the cases' ranges are reproducible. */
export const evalClientDate = "2026-11-25"

const draft = (id: string, fields: string) =>
  `propose_expense returned {"id":"${id}"} for ${fields}`

/** The scenarios, cycled to make up the requested number of generations. */
export const evalCases: ReadonlyArray<EvalCase> = [
  {
    name: "draft-from-text",
    expect: "ui",
    message: "beli baju 70rb",
    context: draft("exp_01JD4X7Q", "Rp70.000 Shopping today"),
    ids: ["exp_01JD4X7Q"],
  },
  {
    name: "draft-from-receipt",
    expect: "ui",
    message: "here's my receipt from Indomaret",
    context: draft("exp_01JD4Y2M", "Rp48.500 Groceries at Indomaret today"),
    ids: ["exp_01JD4Y2M"],
  },
  {
    name: "two-drafts",
    expect: "ui",
    message: "lunch 35k and grab home 22k",
    context: [
      draft("exp_01JD5A11", "Rp35.000 Dining today"),
      draft("exp_01JD5A12", "Rp22.000 Transport today"),
    ].join("; "),
    ids: ["exp_01JD5A11", "exp_01JD5A12"],
  },
  {
    name: "show-expense",
    expect: "ui",
    message: "show me the coffee I logged yesterday",
    context: 'get_expense returned {"id":"exp_01JD3Q9Z","merchant":"Kopi Kenangan"}',
    ids: ["exp_01JD3Q9Z"],
  },
  { name: "list-drafts", expect: "ui", message: "what drafts haven't I confirmed?" },
  { name: "list-this-month", expect: "ui", message: "list everything I spent this month" },
  {
    name: "chart-by-category",
    expect: "ui",
    message: "chart my spending by category for this month",
  },
  {
    name: "chart-by-month",
    expect: "ui",
    message: "show a line chart of my monthly spending this year",
  },
  {
    name: "total-question",
    expect: "either",
    message: "how much did I spend last month?",
    context: 'query_spending returned [{"month":"2026-10","total":3250000}]',
  },
  {
    name: "how-to",
    expect: "prose",
    message: "how do I change the category of an expense?",
  },
  { name: "greeting", expect: "prose", message: "hi! what can you do?" },
  {
    name: "confirm-request",
    expect: "either",
    message: "yes, confirm it for me",
    context: draft("exp_01JD4X7Q", "Rp70.000 Shopping today"),
    ids: ["exp_01JD4X7Q"],
  },
]

/** The ids the program's cards show. */
const shownIds = (node: unknown): ReadonlyArray<string> => {
  if (Array.isArray(node)) return node.flatMap(shownIds)
  if (!isElementNode(node)) return []
  const element: ElementNode = node
  const own =
    (element.typeName === "DraftExpenseCard" || element.typeName === "ExpenseCard") &&
    typeof element.props["id"] === "string"
      ? [element.props["id"]]
      : []
  return [...own, ...Object.values(element.props).flatMap(shownIds)]
}

/** Grades one reply against its case. */
export const gradeReply = (
  evalCase: EvalCase,
  reply: { readonly text: string; readonly finishReason: string | undefined },
): EvalResult => {
  const check = checkProgram(reply.text, { finishReason: reply.finishReason })
  const outcome = ((): EvalOutcome => {
    if (check.outcome === "prose") return evalCase.expect === "ui" ? "prose-instead-of-ui" : "prose"
    if (check.outcome !== "ok") return check.outcome
    if (evalCase.expect === "prose") return "forced-ui"
    const allowed = new Set(evalCase.ids ?? [])
    const invented = shownIds(parseProgram(reply.text).root).some((id) => !allowed.has(id))
    return invented ? "invented-id" : "ok"
  })()
  const passed = outcome === "ok" || (outcome === "prose" && evalCase.expect !== "ui")
  return { case: evalCase.name, outcome, passed, problems: check.problems, text: reply.text }
}

/** The prompt for a case, shaped exactly as a Chat turn's, with its tool context before the message. */
export const casePrompt = (evalCase: EvalCase): Prompt.RawInput => {
  const messages = [
    ...buildPrompt(systemPrompt, [], { message: evalCase.message, clientDate: evalClientDate }),
  ]
  if (evalCase.context === undefined) return messages
  const last = messages.pop()!
  return [
    ...messages,
    { role: "system", content: `Tool results this turn: ${evalCase.context}` },
    last,
  ]
}

const generate = (evalCase: EvalCase) =>
  Effect.gen(function* () {
    let text = ""
    let finishReason: string | undefined
    yield* runAgentLoop({ prompt: casePrompt(evalCase) }).pipe(
      Stream.runForEach((part: Response.AnyPart) =>
        Effect.sync(() => {
          if (part.type === "text-delta") text += part.delta
          if (part.type === "finish") finishReason = part.reason
        }),
      ),
    )
    return gradeReply(evalCase, { text, finishReason })
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed<EvalResult>({
        case: evalCase.name,
        outcome: "model-error",
        passed: false,
        problems: [String(error)],
        text: "",
      }),
    ),
  )

export interface EvalOptions {
  readonly cases?: ReadonlyArray<EvalCase> | undefined
  readonly generations: number
  readonly concurrency: number
  /** Called after each generation, e.g. to print progress. */
  readonly onResult?: ((result: EvalResult, done: number) => Effect.Effect<void>) | undefined
}

/** Runs `generations` turns, cycling the cases, against whatever `LanguageModel` is provided. */
export const runEval = (options: EvalOptions) =>
  Effect.gen(function* () {
    const cases = options.cases ?? evalCases
    let done = 0
    const results = yield* Effect.forEach(
      Array.from({ length: options.generations }, (_, index) => cases[index % cases.length]!),
      (evalCase) =>
        generate(evalCase).pipe(
          Effect.tap((result) => options.onResult?.(result, ++done) ?? Effect.void),
        ),
      { concurrency: options.concurrency },
    )
    return {
      generations: results.length,
      passed: results.filter((result) => result.passed).length,
      results,
    } satisfies EvalReport
  })

const percent = (part: number, whole: number) =>
  whole === 0 ? "0.0%" : `${((part / whole) * 100).toFixed(1)}%`

const oneLine = (text: string) => text.replaceAll("|", "\\|").replaceAll(/\s+/g, " ").trim()

/** The results as Markdown, for `docs/research/openui-eval.md`. */
export const formatReport = (
  report: EvalReport & { readonly model: string; readonly ranAt: string },
): string => {
  const count = (outcome: EvalOutcome) =>
    report.results.filter((result) => result.outcome === outcome).length
  const caseNames = [...new Set(report.results.map((result) => result.case))]
  const failures = report.results.filter((result) => !result.passed)
  return [
    `Model: \`${report.model}\` · Ran: ${report.ranAt} · Generations: ${report.generations}`,
    "",
    `**Pass rate: ${percent(report.passed, report.generations)}** (${report.passed} of ${report.generations})`,
    "",
    "| Outcome | Count |",
    "|---|---|",
    ...evalOutcomes.map((outcome) => `| ${outcome} | ${count(outcome)} |`),
    "",
    "| Case | Passed | Outcomes |",
    "|---|---|---|",
    ...caseNames.map((name) => {
      const ofCase = report.results.filter((result) => result.case === name)
      const outcomes = evalOutcomes
        .map(
          (outcome) =>
            [outcome, ofCase.filter((result) => result.outcome === outcome).length] as const,
        )
        .filter(([, n]) => n > 0)
        .map(([outcome, n]) => `${outcome} ×${n}`)
        .join(", ")
      return `| ${name} | ${ofCase.filter((result) => result.passed).length}/${ofCase.length} | ${outcomes} |`
    }),
    "",
    failures.length === 0 ? "No failures." : "Failures (first 20):",
    "",
    ...failures
      .slice(0, 20)
      .map(
        (result) =>
          `- **${result.case}** — ${result.outcome}${result.problems.length > 0 ? `: ${oneLine(result.problems.join("; "))}` : ""}\n  \`${oneLine(result.text.replaceAll("```", "~~~")).slice(0, 240)}\``,
      ),
  ].join("\n")
}

/**
 * A stand-in model for a dry run: no network, no key. It answers in turn
 * with a valid program, prose, and each failure mode, so a dry run exercises
 * every branch of the grading and the report.
 */
export const fakeEvalModel = Layer.effect(
  LanguageModel.LanguageModel,
  Effect.suspend(() => {
    const replies: ReadonlyArray<readonly [string, "stop" | "length"]> = [
      [
        'Here it is:\n```openui-lang\nroot = Stack([c])\nc = DraftExpenseCard("exp_01JD4X7Q")\n```',
        "stop",
      ],
      ["You spent Rp3.250.000 last month.", "stop"],
      ['```openui-lang\nc = ExpenseCard("exp_01JD3Q9Z")\n```', "stop"],
      ['```openui-lang\nroot = Stack([a, b])\na = ExpenseList("draft")\n```', "stop"],
      [
        '```openui-lang\nroot = Stack([c])\nc = SpendingChart("2026-11-01", "2026-11-30", "week", "bar")\n```',
        "stop",
      ],
      ['```openui-lang\nroot = Stack([c])\nc = ExpenseList("confirmed", "2026-11-0', "length"],
      [
        '```openui-lang\nroot = Stack([SpendingChart("2026-01-01", "2026-11-30", "month", "line")])\n```',
        "stop",
      ],
    ]
    let call = 0
    const usage = { inputTokens: {}, outputTokens: {} }
    return LanguageModel.make({
      generateText: () => Effect.die("the fake eval model only streams"),
      streamText: () =>
        Stream.suspend(() => {
          const [text, reason] = replies[call++ % replies.length]!
          return Stream.fromIterable<Response.StreamPartEncoded>([
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: text },
            { type: "text-end", id: "t" },
            { type: "finish", reason, usage },
          ])
        }),
    })
  }),
)

/** A Secrets Store binding over a plain value, for running the real provider outside a Worker. */
export const plainSecret = (value: string): ModelProviderConfig["apiKey"] => ({
  get: () => Promise.resolve(value),
})
