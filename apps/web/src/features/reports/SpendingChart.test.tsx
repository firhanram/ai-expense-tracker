import type { Report } from "@expense/contract"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { fakeApi, fail, ok } from "../../shared/testing/fakeApi.ts"
import { SpendingChartView, type SpendingChartProps } from "./SpendingChart.tsx"

const november: Report = {
  from: "2026-11-01",
  to: "2026-11-30",
  groupBy: "category",
  total: 1_632_500,
  // Category order, as the server sends it.
  totals: [
    { label: "Groceries", categoryId: 1, amount: 980_000 },
    { label: "Dining", categoryId: 2, amount: 612_500 },
    { label: "Transport", categoryId: 3, amount: 187_500 },
    { label: "Shopping", categoryId: 6, amount: -147_500 },
  ],
}

const show = (props: SpendingChartProps) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SpendingChartView {...props} />
    </QueryClientProvider>,
  )

const figures = async () =>
  within(await screen.findByRole("list", { name: /figures/ }))
    .getAllByRole("listitem")
    .map((item) => item.textContent)

describe("the SpendingChart", () => {
  it("asks the server for the range's Report and titles it in words", async () => {
    const { calls } = fakeApi({ "GET /api/reports": ok(november) })
    show({ from: "2026-11-01", to: "2026-11-30", groupBy: "category", chartType: "bar" })

    const chart = await screen.findByRole("figure", { name: "November 2026 by category" })
    expect(within(chart).getByText("November 2026")).toBeInTheDocument()
    expect(within(chart).getByText("by category")).toBeInTheDocument()
    expect(within(chart).getByText("Rp1.632.500")).toBeInTheDocument()
    expect(calls.map((call) => Object.fromEntries(call.query))).toEqual([
      { from: "2026-11-01", to: "2026-11-30", groupBy: "category" },
    ])
  })

  it("lists the server's figures largest first, refunds last, as its text alternative", async () => {
    fakeApi({ "GET /api/reports": ok(november) })
    show({ from: "2026-11-01", to: "2026-11-30", groupBy: "category", chartType: "bar" })

    expect(await figures()).toEqual([
      "Groceries: Rp980.000",
      "Dining: Rp612.500",
      "Transport: Rp187.500",
      "Shopping: −Rp147.500",
    ])
  })

  it("names months in words when grouped by month", async () => {
    fakeApi({
      "GET /api/reports": ok({
        from: "2026-01-01",
        to: "2026-06-30",
        groupBy: "month",
        total: 3_000_000,
        totals: [
          { label: "2026-01", categoryId: null, amount: 2_000_000 },
          { label: "2026-03", categoryId: null, amount: 1_000_000 },
        ],
      } satisfies Report),
    })
    show({ from: "2026-01-01", to: "2026-06-30", groupBy: "month", chartType: "line" })

    expect(
      await screen.findByRole("figure", { name: "January – June 2026 by month" }),
    ).toBeInTheDocument()
    // Months stay in time order; the chart never re-sorts a timeline.
    expect(await figures()).toEqual(["Jan 2026: Rp2.000.000", "Mar 2026: Rp1.000.000"])
  })

  it.each([
    [{ from: "2026-01-01", to: "2026-12-31" }, "2026"],
    [{ from: "2025-12-01", to: "2026-02-28" }, "December 2025 – February 2026"],
    [{ from: "2026-11-24", to: "2026-11-24" }, "24 Nov 2026"],
    [{ from: "2026-11-01", to: "2026-11-15" }, "1–15 Nov 2026"],
    [{ from: "2026-10-20", to: "2026-11-15" }, "20 Oct – 15 Nov 2026"],
    [{ from: "2025-12-24", to: "2026-01-05" }, "24 Dec 2025 – 5 Jan 2026"],
  ])("titles %o as %s", async (range, title) => {
    fakeApi({ "GET /api/reports": ok({ ...november, ...range }) })
    show({ ...range, groupBy: "category", chartType: "bar" })

    expect(await screen.findByRole("figure", { name: `${title} by category` })).toBeInTheDocument()
  })

  it("says so in one line when the range has no expenses", async () => {
    fakeApi({ "GET /api/reports": ok({ ...november, total: 0, totals: [] }) })
    show({ from: "2026-11-01", to: "2026-11-30", groupBy: "category", chartType: "bar" })

    expect(await screen.findByText("No expenses in this range")).toBeInTheDocument()
    expect(screen.queryByRole("figure")).not.toBeInTheDocument()
  })

  it("shows a loading card, then a line if the Report cannot load", async () => {
    fakeApi({ "GET /api/reports": fail("INTERNAL_ERROR") })
    show({ from: "2026-11-01", to: "2026-11-30", groupBy: "category", chartType: "bar" })

    expect(screen.getByRole("status", { name: "Spending chart" })).toBeInTheDocument()
    expect(await screen.findByText("Couldn't load this report")).toBeInTheDocument()
  })
})
