import type { ChatMessage, Expense } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { type ApiCall, mockApi, ok, stream } from "./support/api.ts"
import { expense } from "./support/fixtures.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

const now = new Date("2026-11-25T10:00:00+07:00")

const message = (
  id: string,
  role: ChatMessage["role"],
  content: string,
  uiText: string | null = null,
): ChatMessage => ({ id, role, content, uiText, createdAt: "2026-11-25T03:00:00.000Z" })

const expenses: ReadonlyArray<Expense> = [
  expense({
    id: "exp-indomaret",
    amount: 146500,
    categoryId: 1,
    merchant: "Indomaret",
    note: "weekly shop",
    occurredAt: "2026-11-22",
  }),
  expense({ id: "exp-uniqlo", amount: 70000, categoryId: 6, merchant: "Uniqlo" }),
  expense({
    id: "exp-padang",
    amount: 45000,
    categoryId: 2,
    merchant: "Padang place",
    occurredAt: "2026-11-21",
  }),
  expense({
    id: "exp-refund",
    amount: -25000,
    categoryId: 6,
    merchant: "Uniqlo refund",
    occurredAt: "2026-11-20",
  }),
]

/** `GET /api/expenses`, filtered by status and Category as the API would. */
const listExpenses = (call: ApiCall) => {
  const status = call.query.get("status") ?? "confirmed"
  const categoryId = call.query.get("categoryId")
  return ok(
    expenses.filter(
      (candidate) =>
        candidate.status === status &&
        (categoryId === null || candidate.categoryId === Number(categoryId)),
    ),
  )
}

/** Newest first, as `GET /api/chat` pages it. */
const stored: ReadonlyArray<ChatMessage> = [
  message(
    "m4",
    "assistant",
    "Here is November so far.",
    'root = Stack([list])\nlist = ExpenseList("confirmed", "2026-11-01", "2026-11-30")',
  ),
  message("m3", "user", "show my november expenses"),
  message(
    "m2",
    "assistant",
    "This one:",
    'root = Stack([card])\ncard = ExpenseCard("exp-indomaret")',
  ),
  message("m1", "user", "what was the indomaret one?"),
]

const history = (messages: ReadonlyArray<ChatMessage>) => ok({ messages, nextBefore: null })

const open = async (page: Page) => {
  await page.clock.setFixedTime(now)
  await page.goto("/")
}

const composer = (page: Page) => page.getByRole("textbox", { name: "Message" })
const log = (page: Page) => page.getByRole("log")
const send = async (page: Page, text: string) => {
  await composer(page).fill(text)
  await composer(page).press("Enter")
}

const liveCard =
  'Logged earlier:\n\n```openui-lang\nroot = Stack([card])\ncard = ExpenseCard("exp-uniqlo")\n```'

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`stored and live generated UI, ${viewport}, ${theme}`, async ({ page }) => {
      await mockApi(page, {
        "GET /api/chat": history(stored),
        "GET /api/expenses": listExpenses,
        "POST /api/chat": stream(liveCard),
      })
      await showAs(page, viewport, theme)
      await open(page)

      const storedCard = log(page).getByRole("article", { name: "Expense Rp146.500" })
      await expect(storedCard).toBeVisible()
      await expect(storedCard.getByText("Indomaret · 22 Nov 2026 · weekly shop")).toBeVisible()
      await expect(storedCard.getByText("Confirmed")).toBeVisible()
      const list = log(page).getByRole("region", { name: "Expenses" })
      await expect(list.getByText("Padang place")).toBeVisible()
      await expect(list.getByText("−Rp25.000")).toBeVisible()
      await screenshot(storedCard, "w11", `expense-card-${viewport}-${theme}`)

      await send(page, "and the uniqlo one?")
      await expect(log(page).getByRole("article", { name: "Expense Rp70.000" })).toBeVisible()
      await expect(log(page).getByText("Logged earlier:")).toBeVisible()

      await screenshot(page, "w11", `generated-${viewport}-${theme}`)
    })

    test(`text-only fallback, ${viewport}, ${theme}`, async ({ page }) => {
      await mockApi(page, {
        "GET /api/chat": history([
          message(
            "m2",
            "assistant",
            "Dining from 17 to 23 November came to Rp187.000 across 6 expenses. The largest was Rp48.000 at Warung Bu Tini on 21 November.",
            'root = Chart("dining")',
          ),
          message("m1", "user", "how much did I spend on dining last week?"),
        ]),
        "GET /api/expenses": listExpenses,
        "POST /api/chat": stream(
          'Here it is.\n\n```openui-lang\nroot = Stack([card])\ncard = ExpenseCard("exp-gone")\n```',
        ),
      })
      await showAs(page, viewport, theme)
      await open(page)

      await expect(log(page).getByText("Showing text only.")).toBeVisible()
      await expect(log(page).getByText(/^Dining from 17 to 23 November/)).toBeVisible()

      await send(page, "show the card for the one I deleted")
      await expect(log(page).getByText("This expense no longer exists")).toBeVisible()

      await screenshot(page, "w11", `fallback-${viewport}-${theme}`)
    })
  }
}

test("a live program that fails shows the prose and retries once", async ({ page }) => {
  let sends = 0
  const replies = [
    "Here you go.\n\n```openui-lang\nroot = Stack([card]\n```",
    'Here you go.\n\n```openui-lang\nroot = Stack([card])\ncard = ExpenseCard("exp-uniqlo")\n```',
  ]
  await mockApi(page, {
    "GET /api/chat": history([]),
    "GET /api/expenses": listExpenses,
    "POST /api/chat": () => {
      sends += 1
      return stream(replies[sends - 1] ?? "")
    },
  })
  await open(page)

  await send(page, "show the uniqlo one")
  await expect(log(page).getByText("Showing text only.")).toBeVisible()
  await expect(log(page).getByText("Here you go.")).toBeVisible()

  await log(page).getByRole("button", { name: "Retry" }).click()

  await expect(log(page).getByRole("article", { name: "Expense Rp70.000" })).toBeVisible()
  await expect(log(page).getByText("Showing text only.")).toHaveCount(0)
  expect(sends).toBe(2)
})

test("a Category-filtered list shows only that Category", async ({ page }) => {
  await mockApi(page, {
    "GET /api/chat": history([
      message(
        "m1",
        "assistant",
        "",
        'root = Stack([list])\nlist = ExpenseList("confirmed", "2026-11-01", "2026-11-30", 6)',
      ),
    ]),
    "GET /api/expenses": listExpenses,
  })
  await open(page)

  const list = log(page).getByRole("region", { name: "Expenses" })
  await expect(list.getByText("Uniqlo", { exact: true })).toBeVisible()
  await expect(list.getByText("Indomaret")).toHaveCount(0)
})
