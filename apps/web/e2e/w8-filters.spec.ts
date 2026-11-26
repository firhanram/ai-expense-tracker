import type { Expense, Report } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { type ApiCall, mockApi, ok } from "./support/api.ts"
import { expense } from "./support/fixtures.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

// The design's November 2026 list (docs/design/design.pen, "Expense List — Desktop").
const november: ReadonlyArray<Expense> = [
  expense({ id: "e1", merchant: "Uniqlo", categoryId: 6, amount: 70000, occurredAt: "2026-11-24" }),
  expense({
    id: "e2",
    merchant: "Warung Bu Tini",
    categoryId: 2,
    amount: 25000,
    occurredAt: "2026-11-24",
  }),
  expense({ id: "e3", merchant: "Gojek", categoryId: 3, amount: 18000, occurredAt: "2026-11-23" }),
  expense({
    id: "e4",
    merchant: "Indomaret",
    categoryId: 1,
    amount: 146500,
    occurredAt: "2026-11-22",
  }),
  expense({
    id: "e5",
    merchant: "Kopi Kenangan",
    categoryId: 2,
    amount: 32000,
    occurredAt: "2026-11-21",
  }),
  expense({
    id: "e6",
    merchant: "Tokopedia — refund",
    categoryId: 6,
    amount: -120000,
    occurredAt: "2026-11-20",
  }),
  expense({
    id: "e7",
    merchant: "Superindo",
    categoryId: 1,
    amount: 412300,
    occurredAt: "2026-11-19",
  }),
  expense({
    id: "e8",
    merchant: "PLN token",
    categoryId: 4,
    amount: 200000,
    occurredAt: "2026-11-18",
  }),
  expense({
    id: "e9",
    merchant: "Bluebird",
    categoryId: 3,
    amount: 64500,
    occurredAt: "2026-11-17",
  }),
]

// The design's per-Category figures ("Expense List — Category Filter Open").
const novemberReport: Report = {
  from: "2026-11-01",
  to: "2026-11-30",
  groupBy: "category",
  total: 2480000,
  totals: [
    { label: "Groceries", categoryId: 1, amount: 980000 },
    { label: "Dining", categoryId: 2, amount: 612500 },
    { label: "Transport", categoryId: 3, amount: 187500 },
    { label: "Utilities", categoryId: 4, amount: 200000 },
    { label: "Shopping", categoryId: 6, amount: 310000 },
    { label: "Health", categoryId: 7, amount: 85000 },
    { label: "Entertainment", categoryId: 8, amount: 54000 },
    { label: "Giving & family", categoryId: 10, amount: 51000 },
  ],
}

// 26 Nov 2026, mid-morning in Jakarta (playwright.config.ts sets the zone).
const today = new Date("2026-11-26T03:00:00Z")

// Answers like the server: the asked range and Category only.
const listFor = (call: ApiCall) => {
  const from = call.query.get("from") ?? ""
  const to = call.query.get("to") ?? ""
  const categoryId = call.query.get("categoryId")
  return ok(
    november.filter(
      (row) =>
        row.occurredAt >= from &&
        row.occurredAt <= to &&
        (categoryId === null || String(row.categoryId) === categoryId),
    ),
  )
}

const openAt = async (page: Page) => {
  await page.clock.setFixedTime(today)
  const api = await mockApi(page, {
    "GET /api/expenses": listFor,
    "GET /api/reports": ok(novemberReport),
  })
  await page.goto("/expenses")
  await expect(page.getByRole("list", { name: "Expenses" }).getByRole("listitem")).toHaveCount(
    november.length,
  )
  return api
}

const lastListQuery = (calls: ReadonlyArray<ApiCall>) =>
  calls.findLast((call) => call.url.startsWith("/api/expenses"))?.url

const filter = (page: Page) => page.getByRole("combobox", { name: "Category filter" })

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`the month header, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await openAt(page)
      await expect(page.getByText("Rp848.300")).toBeVisible()
      await screenshot(page, "w8", `closed-${viewport}-${theme}`)
    })

    test(`the Category filter open, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await openAt(page)
      await filter(page).click()
      await expect(page.getByRole("option", { name: /^Groceries/ })).toContainText("980.000")
      await screenshot(page, "w8", `open-${viewport}-${theme}`)
    })
  }
}

test("steps months and filters, sending the browser's month range and the Category", async ({
  page,
}) => {
  await showAs(page, "desktop", "light")
  const { calls } = await openAt(page)

  await filter(page).click()
  await page.getByRole("option", { name: /^Dining/ }).click()
  await expect(page.getByRole("list", { name: "Expenses" }).getByRole("listitem")).toHaveCount(2)
  await expect(filter(page)).toHaveText("Dining")
  await expect(page.getByText("Rp57.000")).toBeVisible()
  expect(lastListQuery(calls)).toBe("/api/expenses?from=2026-11-01&to=2026-11-30&categoryId=2")

  await page.getByRole("button", { name: "Next month" }).click()
  await expect(page.getByRole("heading", { name: "December 2026" })).toBeVisible()
  await expect(page.getByText("No Dining expenses in December 2026")).toBeVisible()
  expect(lastListQuery(calls)).toBe("/api/expenses?from=2026-12-01&to=2026-12-31&categoryId=2")
  expect(calls.findLast((call) => call.url.startsWith("/api/reports"))?.url).toBe(
    "/api/reports?from=2026-12-01&to=2026-12-31&groupBy=category",
  )

  await filter(page).click()
  await page.getByRole("option", { name: /^All categories/ }).click()
  await page.getByRole("button", { name: "Previous month" }).click()
  await page.getByRole("button", { name: "Previous month" }).click()
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible()
  await expect(page.getByText("No expenses in October 2026")).toBeVisible()
  expect(lastListQuery(calls)).toBe("/api/expenses?from=2026-10-01&to=2026-10-31")
})
