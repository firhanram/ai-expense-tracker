import { type ChatMessage, SendChatMessage } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { Schema } from "effect"
import { type ApiCall, fail, mockApi, ok, stream } from "./support/api.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

const now = new Date("2026-11-25T10:00:00+07:00")

const message = (id: string, role: ChatMessage["role"], content: string): ChatMessage => ({
  id,
  role,
  content,
  uiText: null,
  createdAt: "2026-11-25T03:00:00.000Z",
})

/** Newest first, as `GET /api/chat` pages it. */
const conversation: ReadonlyArray<ChatMessage> = [
  message(
    "m4",
    "assistant",
    "Dining from 17 to 23 November came to Rp187.000 across 6 expenses. The largest was Rp48.000 at Warung Bu Tini on 21 November.",
  ),
  message("m3", "user", "how much did I spend on dining last week?"),
  message("m2", "assistant", "Updated. Check it and confirm when it looks right."),
  message("m1", "user", "that was actually 164.500, not 146.500"),
]

const history = (messages: ReadonlyArray<ChatMessage>) => ok({ messages, nextBefore: null })

const open = async (page: Page) => {
  await page.clock.setFixedTime(now)
  await page.goto("/")
}

const composer = (page: Page) => page.getByRole("textbox", { name: "Message" })
const log = (page: Page) => page.getByRole("log")
const sentBodies = (calls: ReadonlyArray<ApiCall>) =>
  calls
    .filter((call) => call.method === "POST" && call.url === "/api/chat")
    .map((call) => call.body)

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`empty Chat, ${viewport}, ${theme}`, async ({ page }) => {
      await mockApi(page, { "GET /api/chat": history([]) })
      await showAs(page, viewport, theme)
      await open(page)

      await expect(page.getByRole("heading", { name: "Where did your money go?" })).toBeVisible()
      await expect(page.getByRole("button", { name: /Log a purchase/ })).toBeVisible()
      await composer(page).fill("lunch at padang place 45rb")

      await screenshot(page, "w10", `empty-${viewport}-${theme}`)
    })

    test(`conversation, ${viewport}, ${theme}`, async ({ page }) => {
      await mockApi(page, {
        "GET /api/chat": history(conversation),
        "POST /api/chat": stream("Noted. Lunch with the team, Rp45.000, today."),
      })
      await showAs(page, viewport, theme)
      await open(page)
      await expect(log(page).getByText("how much did I spend on dining last week?")).toBeVisible()

      await composer(page).fill("lunch with team 45rb")
      await composer(page).press("Enter")
      await expect(
        log(page).getByText("Noted. Lunch with the team, Rp45.000, today."),
      ).toBeVisible()

      await screenshot(page, "w10", `conversation-${viewport}-${theme}`)
    })

    test(`errors, ${viewport}, ${theme}`, async ({ page, context }) => {
      await mockApi(page, {
        "GET /api/chat": history(conversation.slice(0, 2)),
        "POST /api/chat": fail("MODEL_UNREACHABLE"),
      })
      await showAs(page, viewport, theme)
      await open(page)
      await expect(log(page).getByText(/Warung Bu Tini/)).toBeVisible()

      await composer(page).fill("lunch 45rb at padang place")
      await composer(page).press("Enter")
      await expect(log(page).getByText("Couldn't reach the model.")).toBeVisible()
      await context.setOffline(true)
      await expect(page.getByText("Offline. Messages will send when reconnected.")).toBeVisible()

      await screenshot(page, "w10", `errors-${viewport}-${theme}`)
      await context.setOffline(false)
    })
  }

  for (const theme of themes) {
    test(`date picker open, ${viewport}, ${theme}`, async ({ page }) => {
      await mockApi(page, { "GET /api/chat": history([]) })
      await showAs(page, viewport, theme)
      await open(page)
      await composer(page).fill("lunch at padang place 45rb")

      await page.getByRole("button", { name: "Expense date: Today" }).click()
      await expect(page.getByRole("grid", { name: "November 2026" })).toBeVisible()

      await screenshot(page, "w10", `date-picker-${viewport}-${theme}`)
    })
  }
}

test("a reply streams in under the message, and history survives a reload", async ({ page }) => {
  const stored: Array<ChatMessage> = []
  const { calls } = await mockApi(page, {
    "GET /api/chat": () => history(stored.toReversed()),
    "POST /api/chat": (call) => {
      const { message: text } = Schema.decodeUnknownSync(SendChatMessage)(call.body)
      stored.push(message(`u${stored.length}`, "user", text))
      stored.push(message(`a${stored.length}`, "assistant", "Logged Rp70.000 at Uniqlo."))
      return stream("Logged Rp70.000 at Uniqlo.")
    },
  })
  await showAs(page, "desktop", "light")
  await open(page)

  await composer(page).fill("buy cloth 70rb")
  await composer(page).press("Enter")

  await expect(log(page).getByText("buy cloth 70rb")).toBeVisible()
  await expect(log(page).getByText("Logged Rp70.000 at Uniqlo.")).toBeVisible()
  await expect(composer(page)).toHaveValue("")
  expect(sentBodies(calls)).toEqual([{ message: "buy cloth 70rb", clientDate: "2026-11-25" }])

  await page.reload()

  await expect(log(page).getByText("buy cloth 70rb")).toBeVisible()
  await expect(log(page).getByText("Logged Rp70.000 at Uniqlo.")).toBeVisible()
})

test("Shift+Enter adds a line and Enter sends", async ({ page }) => {
  const { calls } = await mockApi(page, {
    "GET /api/chat": history([]),
    "POST /api/chat": stream("Noted."),
  })
  await showAs(page, "desktop", "light")
  await open(page)

  await composer(page).pressSequentially("first")
  await composer(page).press("Shift+Enter")
  await composer(page).pressSequentially("second")
  await expect(composer(page)).toHaveValue("first\nsecond")
  expect(sentBodies(calls)).toEqual([])

  await composer(page).press("Enter")

  await expect(log(page).getByText("Noted.")).toBeVisible()
  expect(sentBodies(calls)).toEqual([{ message: "first\nsecond", clientDate: "2026-11-25" }])
})

test("a message sent while a reply streams waits for it, and the composer stays open", async ({
  page,
}) => {
  const { calls } = await mockApi(page, {
    "GET /api/chat": history([]),
    "POST /api/chat": stream("Second reply."),
  })
  const { promise: firstHeld, resolve: releaseFirst } = Promise.withResolvers<void>()
  let held = false
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST" || held) return route.fallback()
    held = true
    await firstHeld
    return route.fulfill({ status: 200, contentType: "text/plain", body: "First reply." })
  })
  await showAs(page, "desktop", "light")
  await open(page)

  await composer(page).fill("one")
  await composer(page).press("Enter")
  await expect(log(page).getByRole("article", { name: "Assistant" })).toHaveAttribute(
    "aria-busy",
    "true",
  )
  await composer(page).fill("two")
  await composer(page).press("Enter")
  await expect(composer(page)).toBeEnabled()
  await expect(log(page).getByText("two")).toBeVisible()
  await screenshot(page, "w10", "streaming-desktop-light")

  releaseFirst()

  await expect(log(page).getByText("First reply.")).toBeVisible()
  await expect(log(page).getByText("Second reply.")).toBeVisible()
  const order = await log(page).getByRole("article").allTextContents()
  expect(order).toEqual(["one", "First reply.", "two", "Second reply."])
  expect(calls.filter((call) => call.method === "POST")).toHaveLength(1)
})

test("the date picker is keyboard operable and its date goes with the message", async ({
  page,
}) => {
  const { calls } = await mockApi(page, {
    "GET /api/chat": history([]),
    "POST /api/chat": stream("Noted for yesterday."),
  })
  await showAs(page, "desktop", "light")
  await open(page)

  const chip = page.getByRole("button", { name: "Expense date: Today" })
  await chip.focus()
  await page.keyboard.press("Enter")
  const grid = page.getByRole("grid", { name: "November 2026" })
  await expect(grid.getByRole("gridcell", { name: /November 25, 2026/ })).toBeFocused()
  await expect(grid.getByRole("gridcell", { name: /November 26, 2026/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  )
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled()
  await expect(grid.getByRole("columnheader").first()).toHaveAccessibleName("Monday")

  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("Enter")

  await expect(page.getByRole("button", { name: "Expense date: Yesterday" })).toBeFocused()

  await page.keyboard.press("Enter")
  await page.keyboard.press("PageUp")
  await expect(page.getByRole("grid", { name: "October 2026" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("grid")).toHaveCount(0)

  await composer(page).fill("lunch 45rb")
  await composer(page).press("Enter")

  await expect(log(page).getByText("Noted for yesterday.")).toBeVisible()
  expect(sentBodies(calls)).toEqual([{ message: "lunch 45rb", clientDate: "2026-11-24" }])
  await expect(page.getByRole("button", { name: "Expense date: Today" })).toBeVisible()
})

test("Retry after an unreachable model sends the message again", async ({ page }) => {
  let attempts = 0
  const { calls } = await mockApi(page, {
    "GET /api/chat": history([]),
    "POST /api/chat": () => {
      attempts += 1
      return attempts === 1 ? fail("MODEL_UNREACHABLE") : stream("Logged.")
    },
  })
  await showAs(page, "desktop", "light")
  await open(page)

  await composer(page).fill("lunch 45rb")
  await composer(page).press("Enter")
  await expect(log(page).getByText("Couldn't reach the model.")).toBeVisible()

  await log(page).getByRole("button", { name: "Retry" }).click()

  await expect(log(page).getByText("Logged.")).toBeVisible()
  await expect(log(page).getByText("Couldn't reach the model.")).toHaveCount(0)
  expect(sentBodies(calls)).toHaveLength(2)
})

test("a refused token says so", async ({ page }) => {
  await mockApi(page, { "GET /api/chat": fail("UNAUTHORIZED") })
  await showAs(page, "desktop", "light")
  await open(page)

  await expect(log(page).getByText("Not authorised. Check the API token.")).toBeVisible()
  await screenshot(page, "w10", "unauthorized-desktop-light")
})
