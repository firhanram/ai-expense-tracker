import type { ChatMessage, Report } from "@expense/contract"
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
import { ChatToolkit } from "../../src/features/chat/ChatToolkit.ts"
import { buildPrompt } from "../../src/features/chat/ChatTurn.ts"
import { draftsShown } from "../../src/features/chat/DraftShown.ts"
import type { ExpenseView } from "../../src/features/chat/DraftTools.ts"
import type { ModelProviderConfig } from "../../src/features/chat/ModelProvider.ts"

/**
 * The OpenUI Lang eval (ADR-0008: "build a small eval against the real
 * component library before wiring the UI"). Each generation is one Chat turn
 * as the app runs it: the same system prompt, prompt shape, agent loop, stop
 * condition and tool definitions (`ChatToolkit`), graded by `checkProgram`
 * from `@expense/ui`. Only the tools' handlers differ: they answer from the
 * case's in-memory ledger, so the eval runs in Node with no D1.
 */

/** One scenario. */
export interface EvalCase {
  readonly name: string
  /** `ui`: must answer with a valid program. `prose`: must not. `either`: valid program or prose. */
  readonly expect: "ui" | "prose" | "either"
  readonly message: string
  /** The Chat before this turn, oldest first: how an earlier card's id reaches the model. */
  readonly history?: ReadonlyArray<Pick<ChatMessage, "role" | "content" | "uiText">> | undefined
  /** Expenses that exist when the turn starts. The tools read and change these. */
  readonly ledger?: ReadonlyArray<ExpenseView> | undefined
  /** What `query_spending` answers, whatever range it is asked for. No spending when omitted. */
  readonly spending?: Pick<Report, "total" | "totals"> | undefined
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

/** The seeded Categories, in order (ADR-0004, `migrations/0002_seed_categories.sql`). */
const categories = [
  "Groceries",
  "Dining",
  "Transport",
  "Utilities",
  "Housing",
  "Shopping",
  "Health",
  "Entertainment",
  "Education",
  "Giving & family",
  "Other",
].map((name, index) => ({ id: index + 1, name }))

const expense = (
  fields: Pick<ExpenseView, "id" | "status" | "amount" | "categoryName" | "merchant"> &
    Partial<ExpenseView>,
): ExpenseView => ({ note: null, occurredAt: "2026-11-24", needsReview: false, ...fields })

const coffee = expense({
  id: "exp_01JD3Q9Z",
  status: "confirmed",
  amount: 28000,
  categoryName: "Dining",
  merchant: "Kopi Kenangan",
})
const shirt = expense({
  id: "exp_01JD4X7Q",
  status: "draft",
  amount: 70000,
  categoryName: "Shopping",
  merchant: null,
  occurredAt: evalClientDate,
})

/** An earlier exchange in which the assistant showed `card` for `id`. */
const shown = (message: string, card: "DraftExpenseCard" | "ExpenseCard", id: string) => [
  { role: "user" as const, content: message, uiText: null },
  {
    role: "assistant" as const,
    content: "Here it is:",
    uiText: `root = Stack([c])\nc = ${card}("${id}")`,
  },
]

/** The scenarios, cycled to make up the requested number of generations. */
export const evalCases: ReadonlyArray<EvalCase> = [
  { name: "draft-from-text", expect: "ui", message: "beli baju 70rb" },
  { name: "draft-with-merchant", expect: "ui", message: "Indomaret 48.500 for groceries" },
  { name: "two-drafts", expect: "ui", message: "lunch 35k and grab home 22k" },
  {
    name: "show-expense",
    expect: "ui",
    message: "show me that coffee again",
    history: shown("kopi kenangan 28rb yesterday", "ExpenseCard", coffee.id),
    ledger: [coffee],
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
    spending: { total: 3250000, totals: [{ label: "2026-10", categoryId: null, amount: 3250000 }] },
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
    history: shown("beli baju 70rb", "DraftExpenseCard", shirt.id),
    ledger: [shirt],
  },
]

/** A tool call that did nothing, as the real handlers return it. */
const fail = (message: string) => Effect.fail({ message })

const category = (name: string) =>
  categories.find((entry) => entry.name.toLowerCase() === name.toLowerCase())

const notACategory = (name: string) =>
  fail(`"${name}" is not a Category. Use one of: ${categories.map((c) => c.name).join(", ")}.`)

/**
 * The Chat's tools over an in-memory ledger: the real definitions, so the
 * model is offered exactly what the Worker offers, with handlers that keep
 * the rules a model can trip on (the closed Category set, Drafts only for
 * update and discard) and nothing else. `knownIds` is every Expense that
 * exists, the ledger's and those proposed this turn.
 */
const evalToolkit = (evalCase: EvalCase) => {
  const ledger = new Map((evalCase.ledger ?? []).map((entry) => [entry.id, entry]))
  let proposed = 0
  const draft = (id: string) =>
    Effect.gen(function* () {
      const found = ledger.get(id)
      if (found === undefined) return yield* fail(`No Draft Expense has id ${id}.`)
      if (found.status !== "draft") return yield* fail(`Expense ${id} is already ${found.status}.`)
      return found
    })
  const save = (entry: ExpenseView) => Effect.sync(() => (ledger.set(entry.id, entry), entry))

  const toolkit = ChatToolkit.pipe(
    Effect.provide(
      ChatToolkit.toLayer({
        search_categories: () => Effect.succeed(categories),
        propose_expense: ({ categoryName, occurredAt, ...fields }) => {
          const found = category(categoryName)
          if (found === undefined) return notACategory(categoryName)
          return save({
            ...fields,
            id: `exp_${evalCase.name}_${++proposed}`,
            status: "draft",
            categoryName: found.name,
            occurredAt: occurredAt ?? evalClientDate,
          })
        },
        update_draft: ({ id, categoryName, ...fields }) =>
          Effect.gen(function* () {
            const current = yield* draft(id)
            const found = categoryName === undefined ? undefined : category(categoryName)
            if (categoryName !== undefined && found === undefined) {
              return yield* notACategory(categoryName)
            }
            const changed = Object.fromEntries(
              Object.entries(fields).filter(([, value]) => value !== undefined),
            )
            return yield* save({
              ...current,
              ...changed,
              ...(found !== undefined && { categoryName: found.name }),
            })
          }),
        discard_draft: ({ id }) =>
          draft(id).pipe(Effect.flatMap((current) => save({ ...current, status: "discarded" }))),
        get_expense: ({ id }) => {
          const found = ledger.get(id)
          return found === undefined ? fail(`No Expense has id ${id}.`) : Effect.succeed(found)
        },
        query_spending: (query) =>
          Effect.succeed({ ...query, ...(evalCase.spending ?? { total: 0, totals: [] }) }),
      }),
    ),
  )
  return { toolkit, knownIds: () => [...ledger.keys()] }
}

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

/** Grades one reply against its case. `knownIds` are the Expenses that exist; any other is invented. */
export const gradeReply = (
  evalCase: EvalCase,
  reply: {
    readonly text: string
    readonly finishReason: string | undefined
    readonly knownIds: ReadonlyArray<string>
  },
): EvalResult => {
  const check = checkProgram(reply.text, { finishReason: reply.finishReason })
  const outcome = ((): EvalOutcome => {
    if (check.outcome === "prose") return evalCase.expect === "ui" ? "prose-instead-of-ui" : "prose"
    if (check.outcome !== "ok") return check.outcome
    if (evalCase.expect === "prose") return "forced-ui"
    const known = new Set(reply.knownIds)
    const invented = shownIds(parseProgram(reply.text).root).some((id) => !known.has(id))
    return invented ? "invented-id" : "ok"
  })()
  const passed = outcome === "ok" || (outcome === "prose" && evalCase.expect !== "ui")
  return { case: evalCase.name, outcome, passed, problems: check.problems, text: reply.text }
}

/** The prompt for a case, shaped exactly as a Chat turn's. */
export const casePrompt = (evalCase: EvalCase): Prompt.RawInput =>
  buildPrompt(
    systemPrompt,
    (evalCase.history ?? []).map(({ role, content, uiText }, index): ChatMessage => ({
      id: `msg_${index}`,
      role,
      content,
      uiText,
      createdAt: `${evalClientDate}T00:00:00.000Z`,
    })),
    { message: evalCase.message, clientDate: evalClientDate },
  )

const generate = (evalCase: EvalCase) =>
  Effect.gen(function* () {
    const tools = evalToolkit(evalCase)
    let text = ""
    let finishReason: string | undefined
    yield* runAgentLoop({
      prompt: casePrompt(evalCase),
      toolkit: yield* tools.toolkit,
      stopAfter: draftsShown(),
    }).pipe(
      Stream.runForEach((part: Response.AnyPart) =>
        Effect.sync(() => {
          if (part.type === "text-delta") text += part.delta
          if (part.type === "finish") finishReason = part.reason
        }),
      ),
    )
    return gradeReply(evalCase, { text, finishReason, knownIds: tools.knownIds() })
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
