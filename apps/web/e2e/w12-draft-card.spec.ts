import { type ChatMessage, EditExpense, Expense } from "@expense/contract"
import { Schema } from "effect"
import { expect, type Locator, type Page, test } from "@playwright/test"
import { type ApiCall, bytes, fail, mockApi, ok, stream } from "./support/api.ts"
import { draft } from "./support/fixtures.ts"
import { drawReceiptPhoto } from "./support/receiptImage.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

const now = new Date("2026-11-25T10:00:00+07:00")

const uniqlo = draft({ id: "d-uniqlo", amount: 70000, categoryId: 6, merchant: "Uniqlo" })
const indomaret = draft({
  id: "d-indomaret",
  amount: 146500,
  categoryId: 1,
  merchant: "Indomaret",
  occurredAt: "2026-11-22",
  needsReview: true,
  receiptKey: "receipt-indomaret",
})

const shopping = { categoryId: 6 } as const

const message = (
  id: string,
  role: ChatMessage["role"],
  content: string,
  uiText: string | null = null,
): ChatMessage => ({
  id,
  role,
  content,
  uiText,
  receiptKey: null,
  createdAt: "2026-11-25T03:00:00.000Z",
})

const readEdit = Schema.decodeUnknownSync(EditExpense)
const readExpense = Schema.decodeUnknownSync(Expense)

const missing = (call: ApiCall) => fail("EXPENSE_NOT_FOUND", { details: { id: call.params["id"] } })

const card = (...ids: ReadonlyArray<string>) =>
  `root = Stack([${ids.map((_, i) => `c${i}`).join(", ")}])\n${ids
    .map((id, i) => `c${i} = DraftExpenseCard("${id}")`)
    .join("\n")}`

const fenced = (prose: string, program: string) =>
  `${prose}\n\n\`\`\`openui-lang\n${program}\n\`\`\``

let receiptPhoto: Buffer

test.beforeAll(async ({ browser }) => {
  receiptPhoto = await drawReceiptPhoto(browser, { width: 600, height: 800 })
})

/**
 * A stateful backend for Drafts by id: confirm, discard and PATCH change what
 * `GET /api/expenses/:id` serves next. Unknown ids are `EXPENSE_NOT_FOUND`.
 */
const backend = async (
  page: Page,
  options: {
    readonly rows: ReadonlyArray<Expense>
    readonly history?: ReadonlyArray<ChatMessage>
    readonly replies?: ReadonlyArray<string>
  },
) => {
  const rows = new Map(options.rows.map((row) => [row.id, row]))
  let sends = 0
  const find = (call: ApiCall) => rows.get(call.params["id"] ?? "")
  const move = (status: Expense["status"]) => (call: ApiCall) => {
    const row = find(call)
    if (row === undefined) return missing(call)
    const moved = { ...row, status }
    rows.set(row.id, moved)
    return ok(moved)
  }
  const api = await mockApi(page, {
    "GET /api/chat": ok({ messages: [...(options.history ?? [])].toReversed(), nextBefore: null }),
    "POST /api/chat": () => {
      sends += 1
      return stream(options.replies?.[sends - 1] ?? "")
    },
    "GET /api/expenses": ok([]),
    "GET /api/expenses/:id": (call) => {
      const row = find(call)
      return row === undefined ? missing(call) : ok(row)
    },
    "GET /api/receipts/:key": () => bytes(receiptPhoto, "image/jpeg"),
    "POST /api/expenses/:id/confirm": move("confirmed"),
    "POST /api/expenses/:id/discard": move("discarded"),
    "PATCH /api/expenses/:id": (call) => {
      const row = find(call)
      if (row === undefined) return missing(call)
      const edited = readExpense({ ...row, ...readEdit(call.body) })
      rows.set(row.id, edited)
      return ok(edited)
    },
  })
  await page.clock.setFixedTime(now)
  return { rows, calls: api.calls }
}

/** Holds every request to `path` until the returned function is called. */
const hold = async (page: Page, path: string) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  await page.route(`**${path}`, async (route) => {
    await promise
    await route.fallback()
  })
  return resolve
}

const log = (page: Page) => page.getByRole("log")
const draftCard = (page: Page, amount: string) =>
  log(page).getByRole("article", { name: `Draft Expense ${amount}` })
const send = async (page: Page, text: string) => {
  const composer = page.getByRole("textbox", { name: "Message" })
  await composer.fill(text)
  await composer.press("Enter")
}
const posts = (calls: ReadonlyArray<ApiCall>) =>
  calls.filter((call) => call.method !== "GET").map((call) => `${call.method} ${call.url}`)

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`Draft cards in a chat, ${viewport}, ${theme}`, async ({ page }) => {
      await backend(page, {
        rows: [uniqlo, indomaret],
        history: [
          message("m1", "user", "buy cloth 70rb"),
          message("m2", "assistant", "", card(uniqlo.id)),
          message("m3", "user", "here's the indomaret one"),
          message("m4", "assistant", "", card(indomaret.id)),
        ],
      })
      await showAs(page, viewport, theme)
      await page.goto("/")

      await expect(draftCard(page, "Rp70.000")).toBeVisible()
      await expect(draftCard(page, "Rp146.500").getByText("Check amount")).toBeVisible()
      await expect(draftCard(page, "Rp146.500").getByRole("img", { name: "Receipt" })).toBeVisible()
      await screenshot(page, "w12", `chat-${viewport}-${theme}`)
    })

    test(`every Draft card state, ${viewport}, ${theme}`, async ({ page }) => {
      const rows = [
        draft({ ...shopping, id: "s-default" }),
        draft({ ...shopping, id: "s-review", needsReview: true }),
        draft({ ...shopping, id: "s-confirming" }),
        draft({ ...shopping, id: "s-confirmed", status: "confirmed" }),
        draft({ ...shopping, id: "s-discarded", status: "discarded" }),
      ]
      await backend(page, {
        rows,
        history: [
          message("m1", "assistant", "", card("s-loading", ...rows.map((row) => row.id), "s-gone")),
        ],
      })
      await hold(page, "/api/expenses/s-loading")
      const releaseConfirm = await hold(page, "/api/expenses/s-confirming/confirm")
      await showAs(page, viewport, theme)
      await page.goto("/")

      const cards = log(page).getByRole("article", { name: "Draft Expense Rp70.000" })
      await expect(cards).toHaveCount(4)
      await cards.nth(2).getByRole("button", { name: "Confirm" }).click()
      await expect(cards.nth(2).getByRole("button", { name: "Confirming…" })).toBeDisabled()
      await expect(cards.nth(2)).toHaveCSS("opacity", "0.7")

      const shoot = async (state: string, target: Locator) => {
        await expect(target).toBeVisible()
        // Centred, so neither the top bar nor the composer overlaps it.
        await target.evaluate((element) => element.scrollIntoView({ block: "center" }))
        await screenshot(target, "w12", `state-${state}-${viewport}-${theme}`)
      }
      await shoot("loading", log(page).getByRole("status", { name: "Draft Expense" }))
      await shoot("default", cards.nth(0))
      await shoot("needs-review", cards.nth(1))
      await shoot("confirming", cards.nth(2))
      await shoot("confirmed", cards.nth(3))
      await shoot("discarded", log(page).getByText("Discarded · Rp70.000 · Uniqlo"))
      await shoot("not-found", log(page).getByText("This draft no longer exists"))
      await screenshot(page, "w12", `states-${viewport}-${theme}`)
      releaseConfirm()
      await expect(cards.nth(2).getByText("Confirmed")).toBeVisible()
    })
  }
}

test("Confirm calls the API once, even when double-clicked", async ({ page }) => {
  const { calls } = await backend(page, {
    rows: [uniqlo],
    history: [message("m1", "assistant", "", card(uniqlo.id))],
  })
  await page.goto("/")

  const target = draftCard(page, "Rp70.000")
  await target.getByRole("button", { name: "Confirm" }).dblclick()

  await expect(target.getByText("Confirmed")).toBeVisible()
  await expect(target.getByRole("button", { name: "Confirm" })).toHaveCount(0)
  expect(posts(calls)).toEqual([`POST /api/expenses/${uniqlo.id}/confirm`])
  expect(calls.filter((call) => call.url === "/api/chat" && call.method === "POST")).toEqual([])
})

test("Discard collapses the card to one line", async ({ page }) => {
  const { calls } = await backend(page, {
    rows: [uniqlo],
    history: [message("m1", "assistant", "", card(uniqlo.id))],
  })
  await page.goto("/")

  await draftCard(page, "Rp70.000").getByRole("button", { name: "Discard" }).click()

  await expect(log(page).getByText("Discarded · Rp70.000 · Uniqlo")).toBeVisible()
  await expect(draftCard(page, "Rp70.000")).toHaveCount(0)
  expect(posts(calls)).toEqual([`POST /api/expenses/${uniqlo.id}/discard`])
})

test("amount, merchant, note, date and Category edit from their chips", async ({ page }) => {
  const { calls } = await backend(page, {
    rows: [uniqlo],
    history: [message("m1", "assistant", "", card(uniqlo.id))],
  })
  await page.goto("/")
  const target = draftCard(page, "Rp70.000")

  await target.getByRole("button", { name: "Edit amount" }).click()
  await page.getByRole("textbox", { name: "amount" }).fill("75.000")
  await page.getByRole("textbox", { name: "amount" }).press("Enter")
  const edited = draftCard(page, "Rp75.000")
  await expect(edited).toBeVisible()

  await edited.getByRole("button", { name: "Edit merchant" }).click()
  await page.getByRole("textbox", { name: "merchant" }).fill("Uniqlo GI")
  await page.getByRole("textbox", { name: "merchant" }).press("Enter")
  await expect(edited.getByRole("button", { name: "Edit merchant" })).toHaveText("Uniqlo GI")

  await edited.getByRole("button", { name: "Edit note" }).click()
  await page.getByRole("textbox", { name: "note" }).fill("jacket")
  await page.getByRole("textbox", { name: "note" }).press("Enter")
  await expect(edited.getByRole("button", { name: "Edit note" })).toHaveText("jacket")

  await edited.getByRole("button", { name: "Edit date" }).click()
  await page.getByRole("button", { name: /^2 days ago/ }).click()
  await expect(edited.getByRole("button", { name: "Edit date" })).toHaveText("23 Nov 2026")

  await edited.getByRole("combobox", { name: "Edit category" }).click()
  await page.getByRole("option", { name: "Groceries" }).click()
  await expect(edited.getByRole("combobox", { name: "Edit category" })).toHaveText("Groceries")

  expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
    { amount: 75000 },
    { merchant: "Uniqlo GI" },
    { note: "jacket" },
    { occurredAt: "2026-11-23" },
    { categoryId: 1 },
  ])
  await screenshot(edited, "w12", "edited-desktop-light")
})

test("each Draft in a row keeps its own card, and the card follows the agent", async ({ page }) => {
  const { rows } = await backend(page, {
    rows: [uniqlo, indomaret],
    replies: [
      fenced("Got it.", card(uniqlo.id)),
      fenced("And this one.", card(indomaret.id)),
      "Updated. Check it and confirm when it looks right.",
    ],
  })
  await page.goto("/")

  await send(page, "buy cloth 70rb")
  await expect(draftCard(page, "Rp70.000")).toBeVisible()
  await send(page, "here's the indomaret one")
  await expect(draftCard(page, "Rp146.500")).toBeVisible()
  await expect(draftCard(page, "Rp70.000")).toBeVisible()

  rows.set(indomaret.id, { ...indomaret, amount: 164500 })
  await send(page, "that was actually 164.500, not 146.500")
  await expect(draftCard(page, "Rp164.500")).toBeVisible()
  await expect(draftCard(page, "Rp70.000")).toBeVisible()
})

test("a card whose Draft is gone says so", async ({ page }) => {
  await backend(page, {
    rows: [],
    history: [message("m1", "assistant", "", card("deleted-draft"))],
  })
  await page.goto("/")

  await expect(log(page).getByText("This draft no longer exists")).toBeVisible()
})
