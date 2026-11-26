import { expect, test } from "@playwright/test"
import { mockApi } from "./support/api.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

const pages = [
  { path: "/", current: "Chat", other: "Expenses", slug: "chat" },
  { path: "/expenses", current: "Expenses", other: "Chat", slug: "expenses" },
] as const

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    for (const { path, current, other, slug } of pages) {
      test(`top bar on ${slug}, ${viewport}, ${theme}`, async ({ page }) => {
        await showAs(page, viewport, theme)
        await page.goto(path)

        const bar = page.getByRole("banner")
        await expect(bar).toHaveCSS("height", "56px")
        await expect(bar.getByRole("link", { name: current })).toHaveAttribute(
          "aria-current",
          "page",
        )
        await expect(bar.getByRole("link", { name: other })).not.toHaveAttribute("aria-current")

        await screenshot(bar, "w4", `top-bar-${slug}-${viewport}-${theme}`)
      })
    }
  }
}

test("the top bar shows 'offline' while the connection is down", async ({ page, context }) => {
  await showAs(page, "desktop", "light")
  await page.goto("/")
  const bar = page.getByRole("banner")
  await expect(bar.getByText("offline")).toHaveCount(0)

  await context.setOffline(true)
  await expect(bar.getByText("offline")).toBeVisible()
  await screenshot(bar, "w4", "top-bar-offline-desktop-light")

  await context.setOffline(false)
  await expect(bar.getByText("offline")).toHaveCount(0)
})

test("the nav links move between Chat and Expenses", async ({ page }) => {
  await showAs(page, "mobile", "light")
  await page.goto("/")

  await page.getByRole("link", { name: "Expenses" }).click()

  await expect(page).toHaveURL(/\/expenses$/)
  await expect(page.getByRole("heading", { name: "Expenses" })).toBeAttached()
  await expect(page.getByRole("link", { name: "Expenses" })).toHaveAttribute("aria-current", "page")
})
