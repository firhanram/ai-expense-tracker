import type { Expense, Report } from "@expense/contract"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type FakeApiCall, fakeApi, ok } from "../../shared/testing/fakeApi.ts"
import { renderApp } from "../../shared/testing/renderApp.tsx"

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "exp-1",
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

const report = (totals: Report["totals"], total: number): Report => ({
  from: "2026-11-01",
  to: "2026-11-30",
  groupBy: "category",
  total,
  totals,
})

beforeEach(() => {
  // 25 Nov 2026 in Jakarta, still the 24th in UTC.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T18:00:00Z") })
})

afterEach(() => {
  vi.useRealTimers()
})

/** The queries sent to `path`, leaving out the Drafts tab's count (`status=draft`), which follows the same filters. */
const queriesTo = (calls: ReadonlyArray<FakeApiCall>, path: string) =>
  calls
    .filter((call) => call.path === path && call.query.get("status") !== "draft")
    .map((call) => Object.fromEntries(call.query))

const step = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  times = 1,
): Promise<void> => {
  if (times === 0) return
  await user.click(screen.getByRole("button", { name }))
  await step(user, name, times - 1)
}

describe("stepping through months", () => {
  it("asks for each month's first and last day, across the year end", async () => {
    const { calls } = fakeApi({
      "GET /api/expenses": ok([]),
      "GET /api/reports": ok(report([], 0)),
    })
    const user = userEvent.setup()
    await renderApp("/expenses")
    await screen.findByText("No expenses in November 2026")

    await step(user, "Next month", 3)
    expect(await screen.findByRole("heading", { name: "February 2027" })).toBeInTheDocument()
    await screen.findByText("No expenses in February 2027")

    expect(queriesTo(calls, "/api/expenses")).toEqual([
      { from: "2026-11-01", to: "2026-11-30" },
      { from: "2026-12-01", to: "2026-12-31" },
      { from: "2027-01-01", to: "2027-01-31" },
      { from: "2027-02-01", to: "2027-02-28" },
    ])
  })

  it("steps back to a leap February", async () => {
    const { calls } = fakeApi({
      "GET /api/expenses": ok([]),
      "GET /api/reports": ok(report([], 0)),
    })
    const user = userEvent.setup()
    await renderApp("/expenses")
    await screen.findByText("No expenses in November 2026")

    await step(user, "Previous month", 9 + 24)
    expect(await screen.findByRole("heading", { name: "February 2024" })).toBeInTheDocument()
    await screen.findByText("No expenses in February 2024")

    expect(queriesTo(calls, "/api/expenses").at(-1)).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    })
  })
})

const november = [
  expense({ id: "a", merchant: "Uniqlo", categoryId: 6, amount: 70000 }),
  expense({ id: "b", merchant: "Warung Bu Tini", categoryId: 2, amount: 25000 }),
  expense({ id: "c", merchant: "Kopi Kenangan", categoryId: 2, amount: 32000 }),
]

// Answers like the server: only the asked Category, when one is asked.
const expensesFor = (call: FakeApiCall) => {
  const categoryId = call.query.get("categoryId")
  return ok(
    categoryId === null
      ? november
      : november.filter((row) => String(row.categoryId) === categoryId),
  )
}

const novemberReport = report(
  [
    { label: "Dining", categoryId: 2, amount: 57000 },
    { label: "Shopping", categoryId: 6, amount: 70000 },
  ],
  127000,
)

const filterButton = () => screen.getByRole("combobox", { name: "Category filter" })

const filterBy = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(filterButton())
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }))
}

const monthTotal = () => screen.getByText("Month total:").parentElement?.textContent

describe("filtering by Category", () => {
  it("lists only the chosen Category's Expenses, with their total, and back to all", async () => {
    const { calls } = fakeApi({
      "GET /api/expenses": expensesFor,
      "GET /api/reports": ok(novemberReport),
    })
    const user = userEvent.setup()
    await renderApp("/expenses")
    await screen.findByText("Uniqlo")
    expect(filterButton()).toHaveTextContent("All categories")
    expect(monthTotal()).toBe("Month total: Rp127.000")

    await filterBy(user, "Dining")

    expect(await screen.findByText("Kopi Kenangan")).toBeInTheDocument()
    expect(screen.queryByText("Uniqlo")).not.toBeInTheDocument()
    expect(filterButton()).toHaveTextContent("Dining")
    expect(monthTotal()).toBe("Month total: Rp57.000")

    await filterBy(user, "All categories")
    expect(await screen.findByText("Uniqlo")).toBeInTheDocument()

    expect(queriesTo(calls, "/api/expenses")).toEqual([
      { from: "2026-11-01", to: "2026-11-30" },
      { from: "2026-11-01", to: "2026-11-30", categoryId: "2" },
      { from: "2026-11-01", to: "2026-11-30" },
    ])
  })

  it("keeps the Category while the month changes", async () => {
    const { calls } = fakeApi({
      "GET /api/expenses": expensesFor,
      "GET /api/reports": ok(novemberReport),
    })
    const user = userEvent.setup()
    await renderApp("/expenses")
    await screen.findByText("Uniqlo")

    await filterBy(user, "Shopping")
    await screen.findByRole("heading", { name: "November 2026" })
    await step(user, "Previous month")
    await screen.findByRole("heading", { name: "October 2026" })

    expect(filterButton()).toHaveTextContent("Shopping")
    await vi.waitFor(() =>
      expect(queriesTo(calls, "/api/expenses").at(-1)).toEqual({
        from: "2026-10-01",
        to: "2026-10-31",
        categoryId: "6",
      }),
    )
  })

  it("shows the month's total per Category, in seeded order, with a dash where nothing was spent", async () => {
    const { calls } = fakeApi({
      "GET /api/expenses": expensesFor,
      "GET /api/reports": ok(novemberReport),
    })
    const user = userEvent.setup()
    await renderApp("/expenses")
    await screen.findByText("Uniqlo")

    await user.click(filterButton())
    const options = await screen.findAllByRole("option")

    expect(options.map((option) => option.textContent)).toEqual([
      "All categories127.000",
      "Groceries—",
      "Dining57.000",
      "Transport—",
      "Utilities—",
      "Housing—",
      "Shopping70.000",
      "Health—",
      "Entertainment—",
      "Education—",
      "Giving & family—",
      "Pets—",
      "Other—",
    ])
    expect(options[0]).toHaveAttribute("aria-selected", "true")
    expect(queriesTo(calls, "/api/reports")).toEqual([
      { from: "2026-11-01", to: "2026-11-30", groupBy: "category" },
    ])
  })

  it("says which Category has nothing in the month", async () => {
    fakeApi({ "GET /api/expenses": expensesFor, "GET /api/reports": ok(novemberReport) })
    const user = userEvent.setup()
    await renderApp("/expenses")
    await screen.findByText("Uniqlo")

    await filterBy(user, "Housing")

    expect(await screen.findByText("No Housing expenses in November 2026")).toBeInTheDocument()
  })
})
