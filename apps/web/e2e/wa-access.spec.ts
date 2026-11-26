import { expect, test } from "@playwright/test"
import { mockApi, ok } from "./support/api.ts"

// ADR-0011: an expired Cloudflare Access session answers API calls with a
// redirect to the Access login. The SPA reloads instead of showing an error,
// so the browser lands on that login screen.
test("an expired Access session reloads the page instead of showing an error", async ({ page }) => {
  let sessionExpired = true
  await mockApi(page, { "GET /api/chat": ok({ messages: [], nextBefore: null }) })
  // Registered after `mockApi`, so it is asked first.
  await page.route("**/api/chat*", async (route) => {
    if (!sessionExpired) return route.fallback()
    sessionExpired = false
    return route.fulfill({
      status: 302,
      headers: { location: "https://owner-team.cloudflareaccess.com/cdn-cgi/access/login" },
    })
  })
  let loads = 0
  page.on("load", () => {
    loads += 1
  })

  await page.goto("/")

  await expect.poll(() => loads).toBe(2)
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible()
  await expect(page.getByRole("log").getByText(/Not authorised|Couldn't/)).toHaveCount(0)
})
