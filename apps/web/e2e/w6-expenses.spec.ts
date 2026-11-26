import type { Expense } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { fail, mockApi, ok } from "./support/api.ts"
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

// 26 Nov 2026, mid-morning in Jakarta (playwright.config.ts sets the zone).
const today = new Date("2026-11-26T03:00:00Z")

const openAt = async (page: Page, expenses: ReadonlyArray<Expense>) => {
  await page.clock.setFixedTime(today)
  const api = await mockApi(page, { "GET /api/expenses": ok(expenses) })
  await page.goto("/expenses")
  await expect(page.getByRole("list", { name: "Expenses" }).getByRole("listitem")).toHaveCount(
    expenses.length,
  )
  return api
}

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`the November list, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await openAt(page, november)

      const first = page.getByRole("list", { name: "Expenses" }).getByRole("listitem").first()
      await expect(first).toHaveCSS("height", "56px")
      await screenshot(page, "w6", `list-${viewport}-${theme}`)
    })
  }
}

test("asks for this month on the user's clock and shows rows in the API's order", async ({
  page,
}) => {
  await showAs(page, "desktop", "light")
  const { calls } = await openAt(page, november)

  expect(calls[0]?.url).toBe("/api/expenses?from=2026-11-01&to=2026-11-30")
  const rows = page.getByRole("list", { name: "Expenses" }).getByRole("listitem")
  await expect(rows.first()).toContainText("24 Nov")
  await expect(rows.last()).toContainText("17 Nov")
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible()
  await expect(page.getByText("−Rp120.000")).toBeVisible()
})

test("the empty month", async ({ page }) => {
  await showAs(page, "desktop", "light")
  await page.clock.setFixedTime(today)
  await mockApi(page, { "GET /api/expenses": ok([]) })
  await page.goto("/expenses")

  await expect(page.getByText("No expenses in November 2026")).toBeVisible()
  await screenshot(page, "w6", "empty-desktop-light")
})

test("adds an Expense by hand and lists it", async ({ page }) => {
  await showAs(page, "desktop", "light")
  await page.clock.setFixedTime(today)
  let stored: ReadonlyArray<Expense> = november.slice(1)
  const { calls } = await mockApi(page, {
    "GET /api/expenses": () => ok(stored),
    "POST /api/expenses": () => {
      stored = november
      return ok(november[0], 201)
    },
  })
  await page.goto("/expenses")
  await expect(page.getByText("Warung Bu Tini")).toBeVisible()

  await page.getByRole("button", { name: "Add expense" }).click()
  const form = page.getByRole("form", { name: "Add expense" })
  await expect(form.getByLabel("Date")).toHaveValue("2026-11-26")
  await form.getByLabel("Amount").fill("70.000")
  await form.getByRole("combobox", { name: "Category" }).click()
  await page.getByRole("option", { name: "Shopping" }).click()
  await form.getByLabel("Merchant").fill("Uniqlo")
  await form.getByLabel("Date").fill("2026-11-24")
  await screenshot(page, "w6", "add-form-desktop-light")

  await form.getByRole("button", { name: "Add expense" }).click()

  await expect(form).toHaveCount(0)
  await expect(page.getByText("Uniqlo")).toBeVisible()
  expect(calls.find((call) => call.method === "POST")?.body).toEqual({
    amount: 70000,
    categoryId: 6,
    merchant: "Uniqlo",
    note: null,
    occurredAt: "2026-11-24",
  })
})

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`shows validation errors against their fields, ${viewport}, ${theme}`, async ({
      page,
    }) => {
      await showAs(page, viewport, theme)
      await page.clock.setFixedTime(today)
      const { calls } = await mockApi(page, {
        "GET /api/expenses": ok(november),
        "POST /api/expenses": fail("VALIDATION_FAILED", {
          details: {
            issues: [{ path: ["payload", "occurredAt"], message: "Expected a date that exists" }],
          },
        }),
      })
      await page.goto("/expenses")
      await page.getByRole("button", { name: "Add expense" }).click()
      const form = page.getByRole("form", { name: "Add expense" })

      await form.getByLabel("Amount").fill("12,5")
      await form.getByRole("button", { name: "Add expense" }).click()
      await expect(form.getByText("Use whole Rupiah")).toBeVisible()
      await expect(form.getByText("Choose a Category")).toBeVisible()
      expect(calls.filter((call) => call.method === "POST")).toHaveLength(0)

      await form.getByLabel("Amount").fill("15000")
      await form.getByRole("combobox", { name: "Category" }).click()
      await page.getByRole("option", { name: "Dining" }).click()
      await form.getByRole("button", { name: "Add expense" }).click()

      await expect(form.getByText("Expected a date that exists")).toBeVisible()
      await screenshot(page, "w6", `add-form-error-${viewport}-${theme}`)
    })
  }
}
