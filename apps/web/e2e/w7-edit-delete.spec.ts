import type { Expense, Report } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { fail, mockApi, type MockHandler, ok } from "./support/api.ts"
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

const today = new Date("2026-11-26T03:00:00Z")

// The month's Category totals; every spec that mutates /expenses must answer
// the totals refetch too, or the unmocked request retries and stalls the page.
const novemberReport: Report = {
  from: "2026-11-01",
  to: "2026-11-30",
  groupBy: "category",
  total: 848300,
  totals: [
    { label: "Groceries", categoryId: 1, amount: 558800 },
    { label: "Dining", categoryId: 2, amount: 57000 },
    { label: "Transport", categoryId: 3, amount: 82500 },
    { label: "Utilities", categoryId: 4, amount: 200000 },
    { label: "Shopping", categoryId: 6, amount: -50000 },
  ],
}

const openList = async (page: Page, routes: Readonly<Record<string, MockHandler>> = {}) => {
  await page.clock.setFixedTime(today)
  const api = await mockApi(page, {
    "GET /api/expenses": ok(november),
    "GET /api/reports": ok(novemberReport),
    ...routes,
  })
  await page.goto("/expenses")
  await expect(page.getByRole("list", { name: "Expenses" }).getByRole("listitem")).toHaveCount(
    november.length,
  )
  return api
}

const row = (page: Page, merchant: string) =>
  page.getByRole("list", { name: "Expenses" }).getByRole("listitem").filter({ hasText: merchant })

for (const theme of themes) {
  test(`desktop row menu and inline delete confirm, ${theme}`, async ({ page }) => {
    await showAs(page, "desktop", theme)
    await openList(page)

    await page.getByRole("button", { name: "Actions for Indomaret, 22 Nov" }).click()
    await page.getByRole("menuitem", { name: "Delete" }).click()
    await expect(row(page, "Indomaret").getByRole("button", { name: "No" })).toBeFocused()

    await page.getByRole("button", { name: "Actions for Uniqlo, 24 Nov" }).click()
    const menu = page.getByRole("menu")
    await expect(menu.getByRole("menuitem")).toHaveText(["Edit", "Delete"])
    await menu.getByRole("menuitem", { name: "Edit" }).hover()
    await screenshot(page, "w7", `menu-confirm-desktop-${theme}`)
  })

  test(`mobile row sheet, ${theme}`, async ({ page }) => {
    await showAs(page, "mobile", theme)
    await openList(page)

    await row(page, "Indomaret").click()
    const sheet = page.getByRole("menu")
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText("Indomaret")
    await expect(sheet).toContainText("22 Nov 2026 · Groceries")
    await expect(sheet).toContainText("Rp146.500")
    await expect(sheet.getByRole("menuitem")).toHaveText(["Edit", "Delete"])
    await page.waitForTimeout(400)
    await screenshot(page, "w7", `sheet-mobile-${theme}`)
  })
}

test("edits an Expense from the row menu", async ({ page }) => {
  await showAs(page, "desktop", "light")
  let stored = november
  const { calls } = await openList(page, {
    "GET /api/expenses": () => ok(stored),
    "PATCH /api/expenses/:id": () => {
      stored = november.map((e) => (e.id === "e4" ? { ...e, amount: 150000 } : e))
      return ok(stored[3])
    },
  })

  await page.getByRole("button", { name: "Actions for Indomaret, 22 Nov" }).click()
  await page.getByRole("menuitem", { name: "Edit" }).click()
  const form = page.getByRole("form", { name: "Edit expense" })
  await expect(form.getByLabel("Amount")).toBeFocused()
  await expect(form.getByLabel("Amount")).toHaveValue("146500")
  await form.getByLabel("Amount").fill("150.000")
  await screenshot(page, "w7", "edit-form-desktop-light")
  await form.getByRole("button", { name: "Save" }).click()

  await expect(form).toHaveCount(0)
  await expect(row(page, "Indomaret")).toContainText("Rp150.000")
  await expect(page.getByRole("button", { name: "Actions for Indomaret, 22 Nov" })).toBeFocused()
  const patch = calls.find((call) => call.method === "PATCH")
  expect(patch?.url).toBe("/api/expenses/e4")
  expect(patch?.body).toEqual({
    amount: 150000,
    categoryId: 1,
    merchant: "Indomaret",
    note: null,
    occurredAt: "2026-11-22",
  })
})

test("shows edit validation errors against their fields", async ({ page }) => {
  await showAs(page, "mobile", "light")
  await openList(page, {
    "PATCH /api/expenses/:id": fail("VALIDATION_FAILED", {
      details: {
        issues: [{ path: ["payload", "occurredAt"], message: "Expected a date that exists" }],
      },
    }),
  })

  await row(page, "Uniqlo").click()
  await page.getByRole("menuitem", { name: "Edit" }).click()
  const form = page.getByRole("form", { name: "Edit expense" })
  await form.getByRole("button", { name: "Save" }).click()
  await expect(form.getByText("Expected a date that exists")).toBeVisible()
  await screenshot(page, "w7", "edit-error-mobile-light")
})

test("deletes after Yes, and No keeps the row", async ({ page }) => {
  await showAs(page, "desktop", "light")
  let stored = november
  const { calls } = await openList(page, {
    "GET /api/expenses": () => ok(stored),
    "DELETE /api/expenses/:id": (call) => {
      stored = stored.filter((e) => e.id !== call.params["id"])
      return ok(null)
    },
  })

  await page.getByRole("button", { name: "Actions for Gojek, 23 Nov" }).click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(row(page, "Gojek")).toContainText("Rp18.000")
  await row(page, "Gojek").getByRole("button", { name: "No" }).click()
  await expect(page.getByRole("button", { name: "Actions for Gojek, 23 Nov" })).toBeFocused()

  await page.getByRole("button", { name: "Actions for Gojek, 23 Nov" }).press("Enter")
  await page.getByRole("menuitem", { name: "Delete" }).press("Enter")
  await row(page, "Gojek").getByRole("button", { name: "Yes, delete Gojek" }).click()

  await expect(row(page, "Gojek")).toHaveCount(0)
  expect(calls.filter((call) => call.method === "DELETE").map((call) => call.url)).toEqual([
    "/api/expenses/e3",
  ])
})

test("deletes from the mobile sheet", async ({ page }) => {
  await showAs(page, "mobile", "light")
  let stored = november
  await openList(page, {
    "GET /api/expenses": () => ok(stored),
    "DELETE /api/expenses/:id": (call) => {
      stored = stored.filter((e) => e.id !== call.params["id"])
      return fail("EXPENSE_NOT_FOUND", { details: { id: call.params["id"] } })
    },
  })

  await row(page, "Indomaret").click()
  await page.getByRole("menuitem", { name: "Delete" }).click()
  await expect(row(page, "Indomaret")).toContainText("Delete?")
  await expect(row(page, "Indomaret")).toContainText("Rp146.500")
  await screenshot(page, "w7", "confirm-mobile-light")
  await row(page, "Indomaret").getByRole("button", { name: "Yes, delete Indomaret" }).click()

  await expect(row(page, "Indomaret")).toHaveCount(0)
})
