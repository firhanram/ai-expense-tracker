import type { Expense } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { type ApiCall, fail, type MockResponse, mockApi, ok } from "./support/api.ts"
import { draft, expense } from "./support/fixtures.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

const drafts: ReadonlyArray<Expense> = [
  draft({ id: "d1", merchant: "Uniqlo", categoryId: 6, amount: 70000, occurredAt: "2026-11-24" }),
  draft({
    id: "d2",
    merchant: "Kopi Kenangan",
    categoryId: 2,
    amount: 32000,
    occurredAt: "2026-11-21",
  }),
  draft({
    id: "d3",
    merchant: "Tokopedia — refund",
    categoryId: 6,
    amount: -120000,
    occurredAt: "2026-11-20",
  }),
]

const confirmed: ReadonlyArray<Expense> = [
  expense({ id: "c1", merchant: "Gojek", categoryId: 3, amount: 18000, occurredAt: "2026-11-23" }),
  expense({
    id: "c2",
    merchant: "Indomaret",
    categoryId: 1,
    amount: 146500,
    occurredAt: "2026-11-22",
  }),
]

const today = new Date("2026-11-26T03:00:00Z")

/** A small stateful backend: confirm and discard move rows between the two lists. */
const openWithServer = async (
  page: Page,
  answers: { confirm?: MockResponse; discard?: MockResponse } = {},
) => {
  const store = { drafts: [...drafts], confirmed: [...confirmed] }
  const move = (to: "confirmed" | "discarded") => (call: ApiCall) => {
    const answer = to === "confirmed" ? answers.confirm : answers.discard
    if (answer !== undefined) return answer
    const id = call.params["id"]
    const found = [...store.drafts, ...store.confirmed].find((row) => row.id === id)
    if (found === undefined) return fail("EXPENSE_NOT_FOUND", { details: { id } })
    const moved = { ...found, status: to }
    store.drafts = store.drafts.filter((row) => row.id !== id)
    if (to === "confirmed")
      store.confirmed = [...store.confirmed.filter((row) => row.id !== id), moved].toSorted(
        (a, b) => b.occurredAt.localeCompare(a.occurredAt),
      )
    return ok(moved)
  }
  await page.clock.setFixedTime(today)
  const api = await mockApi(page, {
    "GET /api/expenses": (call) =>
      ok(call.query.get("status") === "draft" ? store.drafts : store.confirmed),
    "POST /api/expenses/:id/confirm": move("confirmed"),
    "POST /api/expenses/:id/discard": move("discarded"),
  })
  await page.goto("/expenses")
  await expect(rows(page)).toHaveCount(confirmed.length)
  return api
}

const rows = (page: Page) => page.getByRole("list", { name: "Expenses" }).getByRole("listitem")

const showDrafts = async (page: Page) => {
  await page.getByRole("radio", { name: "Drafts" }).click()
  await expect(rows(page)).toHaveCount(drafts.length)
}

const posts = (calls: ReadonlyArray<ApiCall>) =>
  calls.filter((call) => call.method === "POST").map((call) => call.url)

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`the Drafts view, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await openWithServer(page)
      await expect(page.getByRole("radio", { name: "Confirmed" })).toBeChecked()
      await screenshot(page, "w9", `confirmed-${viewport}-${theme}`)

      await showDrafts(page)
      await expect(rows(page).first().getByText("Draft", { exact: true })).toBeVisible()
      await screenshot(page, "w9", `drafts-${viewport}-${theme}`)
    })
  }
}

test("a double-clicked Confirm sends one request and moves the row to Confirmed", async ({
  page,
}) => {
  await showAs(page, "desktop", "light")
  const { calls } = await openWithServer(page)
  await showDrafts(page)

  await page.getByRole("button", { name: "Confirm Uniqlo" }).dblclick()

  await expect(rows(page)).toHaveCount(drafts.length - 1)
  await expect(page.getByText("Uniqlo")).toHaveCount(0)
  await page.getByRole("radio", { name: "Confirmed" }).click()
  await expect(rows(page).first()).toContainText("Uniqlo")
  await expect(page.getByText("Rp234.500")).toBeVisible()
  expect(posts(calls)).toEqual(["/api/expenses/d1/confirm"])
})

test("Discard drops the Draft and it never counts as spent", async ({ page }) => {
  await showAs(page, "desktop", "light")
  const { calls } = await openWithServer(page)
  await showDrafts(page)

  await page.getByRole("button", { name: "Discard Kopi Kenangan" }).click()

  await expect(page.getByText("Kopi Kenangan")).toHaveCount(0)
  await expect.poll(() => posts(calls)).toEqual(["/api/expenses/d2/discard"])
  await page.getByRole("radio", { name: "Confirmed" }).click()
  await expect(rows(page)).toHaveCount(confirmed.length)
  await expect(page.getByText("Kopi Kenangan")).toHaveCount(0)
})

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`a failed confirm puts the Draft back, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await openWithServer(page, { confirm: fail("INTERNAL_ERROR") })
      await showDrafts(page)

      await page.getByRole("button", { name: "Confirm Uniqlo" }).click()

      await expect(page.getByRole("alert")).toHaveText("Couldn't confirm Uniqlo. Try again.")
      await expect(rows(page)).toHaveCount(drafts.length)
      await expect(rows(page).first()).toContainText("Uniqlo")
      await screenshot(page, "w9", `confirm-error-${viewport}-${theme}`)
    })
  }
}
