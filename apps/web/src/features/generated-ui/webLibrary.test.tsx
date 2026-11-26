import type { Expense } from "@expense/contract"
import { createParser, Renderer } from "@openuidev/react-lang"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { fakeApi, ok } from "../../shared/testing/fakeApi.ts"
import { webLibrary } from "./webLibrary.tsx"

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "exp_1",
  amount: 70000,
  categoryId: 6,
  merchant: "Uniqlo",
  note: null,
  occurredAt: "2026-11-24",
  createdAt: "2026-11-24T03:00:00.000Z",
  status: "confirmed",
  needsReview: false,
  receiptKey: null,
  ...overrides,
})

/** One program per component, as the model writes it, and what shows once it mounts. */
const samples = [
  {
    name: "ExpenseCard",
    program: 'root = Stack([card])\ncard = ExpenseCard("exp_1")',
    shows: () => screen.findByText("Rp70.000"),
  },
  {
    name: "ExpenseList",
    program: 'root = Stack([list])\nlist = ExpenseList("confirmed", "2026-11-01", "2026-11-30", 6)',
    shows: () => screen.findByText("Uniqlo"),
  },
  {
    name: "DraftExpenseCard",
    program: 'root = Stack([draft])\ndraft = DraftExpenseCard("exp_1")',
    shows: () => screen.findByRole("status", { name: "Draft Expense" }),
  },
  {
    name: "SpendingChart",
    program:
      'root = Stack([chart])\nchart = SpendingChart("2026-11-01", "2026-11-30", "category", "bar")',
    shows: () => screen.findByRole("status", { name: "Spending chart" }),
  },
] as const

const parser = createParser(webLibrary.toJSONSchema(), webLibrary.root)

describe("the web library (S3)", () => {
  for (const sample of samples) {
    it(`round-trips ${sample.name} through parse and mounts it`, async () => {
      fakeApi({ "GET /api/expenses": ok([expense()]) })

      const result = parser.parse(sample.program)
      expect(result.meta.errors).toEqual([])
      expect(result.root?.typeName).toBe("Stack")

      render(
        <QueryClientProvider client={new QueryClient()}>
          <Renderer response={sample.program} library={webLibrary} />
        </QueryClientProvider>,
      )
      expect(await sample.shows()).toBeInTheDocument()
    })
  }

  it("lists every component of the shared library", () => {
    expect(Object.keys(webLibrary.components).toSorted()).toEqual([
      "DraftExpenseCard",
      "ExpenseCard",
      "ExpenseList",
      "SpendingChart",
      "Stack",
    ])
  })

  it("adds the card's actions on the web only (ADR-0007)", () => {
    expect(Object.keys(webLibrary.actions).toSorted()).toEqual(["ConfirmExpense", "DiscardExpense"])
  })
})
