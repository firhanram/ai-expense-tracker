import { createLibrary, type ElementNode, isElementNode, jsonToOpenUI } from "@openuidev/lang-core"
import { describe, expect, it } from "vitest"
import {
  components,
  ConfirmExpense,
  DiscardExpense,
  generatedSystemPrompt,
  library,
  parseProgram,
  systemPrompt,
} from "./index.ts"

/** One example of every component, with the props the model would write. */
const samples = {
  DraftExpenseCard: { id: "exp_draft_1" },
  ExpenseCard: { id: "exp_2" },
  ExpenseList: { status: "confirmed", from: "2026-11-01", to: "2026-11-30", categoryId: 3 },
  SpendingChart: { from: "2026-01-01", to: "2026-11-30", groupBy: "month", chartType: "line" },
} as const

const element = (typeName: string, props: Record<string, unknown>): ElementNode => ({
  type: "element",
  typeName,
  props,
  partial: false,
})

describe("the component library (S3)", () => {
  for (const [name, props] of Object.entries(samples)) {
    it(`round-trips ${name} through prompt generation and parse`, () => {
      expect(systemPrompt).toContain(`${name}(`)

      const program = jsonToOpenUI(element("Stack", { children: [element(name, props)] }), library)
      const result = parseProgram(program)

      expect(result.meta.errors).toEqual([])
      expect(result.root?.typeName).toBe("Stack")
      const children = result.root?.props["children"]
      expect(Array.isArray(children)).toBe(true)
      const nodes = (Array.isArray(children) ? children : []).filter(isElementNode)
      expect(nodes.map((child) => [child.typeName, child.props])).toEqual([[name, props]])
    })
  }

  it("ships the Worker the prompt the library generates", () => {
    // If this fails, run `pnpm --filter @expense/ui generate`.
    expect(systemPrompt).toBe(generatedSystemPrompt)
  })

  it("takes ids and ranges, never amounts (ADR-0001)", () => {
    expect(systemPrompt).toContain("DraftExpenseCard(id: string)")
    expect(systemPrompt).toContain("ExpenseCard(id: string)")
    expect(systemPrompt).not.toMatch(/amount\s*[?:]/i)
  })

  it("is told questions may be answered in prose (inline mode)", () => {
    expect(systemPrompt).toContain("openui-lang")
    const prose = parseProgram("You spent Rp70.000 on dining last month.")
    expect(prose.meta.statementCount).toBe(0)
  })

  it("never tells the model it can confirm or discard (ADR-0007)", () => {
    expect(systemPrompt).not.toContain("ConfirmExpense")
    expect(systemPrompt).not.toContain("DiscardExpense")
    expect(Object.keys(library.toJSONSchema().actions ?? {})).toEqual([])
  })

  it("keeps the card's actions client-only, since a library action is advertised to the model", () => {
    const withActions = createLibrary({
      components,
      root: "Stack",
      actions: [ConfirmExpense, DiscardExpense],
    })

    expect(withActions.prompt({ inlineMode: true })).toContain("ConfirmExpense")
  })
})
