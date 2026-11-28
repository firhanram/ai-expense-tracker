import {
  type ChatMessage,
  type Expense,
  maxReceiptBytes,
  type Report,
  SendChatMessage,
} from "@expense/contract"
import { expect, type Locator, type Page, test } from "@playwright/test"
import { Schema } from "effect"
import { type ApiCall, bytes, fail, mockApi, ok, stream } from "./support/api.ts"
import { draft, expense } from "./support/fixtures.ts"
import { drawReceiptPhoto, jpegSize } from "./support/receiptImage.ts"
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
  receiptKey: "rk-indomaret",
})
// What the server makes of a photo nobody can read (PLAN, "Receipts").
const unreadable = draft({
  id: "d-unreadable",
  amount: 0,
  categoryId: 11,
  merchant: null,
  needsReview: true,
  receiptKey: "rk-blurry",
})

const message = (
  id: string,
  role: ChatMessage["role"],
  content: string,
  uiText: string | null = null,
  receiptKey: string | null = null,
): ChatMessage => ({ id, role, content, uiText, receiptKey, createdAt: "2026-11-25T03:00:00.000Z" })

const card = (id: string) => `root = Stack([c0])\nc0 = DraftExpenseCard("${id}")`
const fenced = (prose: string, program: string) =>
  `${prose}\n\n\`\`\`openui-lang\n${program}\n\`\`\``

let photo: Buffer
let thumbnail: Buffer

test.beforeAll(async ({ browser }) => {
  // A 12MP phone photo to upload, and a small one for the API to serve back.
  photo = await drawReceiptPhoto(browser, { width: 3024, height: 4032 })
  thumbnail = await drawReceiptPhoto(browser, { width: 600, height: 800 })
})

const readSent = Schema.decodeUnknownSync(SendChatMessage)

/** The file part of a multipart `POST /api/receipts`. */
const uploadedFile = async (call: ApiCall) => {
  const form = await new Response(call.raw === null ? null : new Uint8Array(call.raw), {
    headers: { "content-type": call.contentType ?? "" },
  }).formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new Error("No file field")
  return { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }
}

const chat = async (
  page: Page,
  options: {
    readonly rows?: ReadonlyArray<Expense>
    readonly history?: ReadonlyArray<ChatMessage>
    readonly reply?: string
  } = {},
) => {
  const rows = new Map((options.rows ?? [uniqlo, indomaret]).map((row) => [row.id, row]))
  const api = await mockApi(page, {
    "GET /api/chat": ok({ messages: [...(options.history ?? [])].toReversed(), nextBefore: null }),
    "POST /api/chat": stream(options.reply ?? fenced("", card(indomaret.id))),
    "POST /api/receipts": ok({ receiptKey: "rk-indomaret" }, 201),
    "GET /api/receipts/:key": bytes(thumbnail, "image/jpeg"),
    "GET /api/expenses": ok([]),
    "GET /api/expenses/:id": (call) => {
      const row = rows.get(call.params["id"] ?? "")
      return row === undefined
        ? fail("EXPENSE_NOT_FOUND", { details: { id: call.params["id"] } })
        : ok(row)
    },
  })
  await page.clock.setFixedTime(now)
  await page.goto("/")
  return api.calls
}

const composer = (page: Page) => page.getByRole("textbox", { name: "Message" })
const log = (page: Page) => page.getByRole("log")
const attachment = (page: Page) => page.getByRole("list", { name: "Attachment" })
const draftCard = (page: Page, amount: string) =>
  log(page).getByRole("article", { name: `Draft Expense ${amount}` })
const uploads = (calls: ReadonlyArray<ApiCall>) =>
  calls.filter((call) => call.method === "POST" && call.url === "/api/receipts")
const chats = (calls: ReadonlyArray<ApiCall>) =>
  calls
    .filter((call) => call.method === "POST" && call.url === "/api/chat")
    .map((c) => readSent(c.body))

const pick = async (page: Page, name = "receipt.jpg", buffer = photo, mimeType = "image/jpeg") => {
  const chooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Attach receipt" }).click()
  await (await chooser).setFiles({ name, mimeType, buffer })
}

/** A `DataTransfer` in the page holding one file. */
const transfer = (page: Page, name: string, buffer: Buffer, type: string) =>
  page.evaluateHandle(
    (file) => {
      const data = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(new File([data], file.name, { type: file.type }))
      return dataTransfer
    },
    { base64: buffer.toString("base64"), name, type },
  )

const dragOver = async (page: Page, target: Locator, name: string) => {
  const dataTransfer = await transfer(page, name, photo, "image/jpeg")
  await target.dispatchEvent("dragenter", { dataTransfer })
  await target.dispatchEvent("dragover", { dataTransfer })
  return dataTransfer
}

test("attaches from the picker, uploads a downscaled JPEG on send, and sends its key", async ({
  page,
}) => {
  await showAs(page, "desktop", "light")
  const calls = await chat(page)

  await pick(page, "IMG_2041.jpg")
  await expect(attachment(page).getByText("IMG_2041.jpg")).toBeVisible()
  expect(uploads(calls)).toHaveLength(0)

  await composer(page).fill("here's the indomaret one")
  await composer(page).press("Enter")

  await expect(draftCard(page, "Rp146.500")).toBeVisible()
  await expect(attachment(page).getByRole("listitem")).toHaveCount(0)
  const mine = log(page).getByRole("article", { name: "You" })
  await expect(mine.getByRole("img", { name: "Receipt" })).toBeVisible()
  await expect(mine.getByText("IMG_2041.jpg")).toHaveCount(0)

  expect(uploads(calls)).toHaveLength(1)
  const upload = uploads(calls)[0]
  expect(upload).toBeDefined()
  const file = await uploadedFile(upload!)
  expect(file.type).toBe("image/jpeg")
  expect(jpegSize(file.bytes)).toEqual({ width: 960, height: 1280 })
  expect(file.bytes.length).toBeLessThan(photo.length)
  expect(file.bytes.length).toBeLessThan(maxReceiptBytes / 10)
  expect(chats(calls)).toEqual([
    { message: "here's the indomaret one", clientDate: "2026-11-25", receiptKey: "rk-indomaret" },
  ])
})

test("sends a photo with no words", async ({ page }) => {
  await showAs(page, "desktop", "light")
  const calls = await chat(page)

  await pick(page)
  await expect(page.getByRole("button", { name: "Send" })).toBeEnabled()
  await page.getByRole("button", { name: "Send" }).click()

  await expect(draftCard(page, "Rp146.500")).toBeVisible()
  expect(chats(calls)).toEqual([
    { message: "Here's a receipt.", clientDate: "2026-11-25", receiptKey: "rk-indomaret" },
  ])
})

test("removes the pending photo with its ×", async ({ page }) => {
  await showAs(page, "desktop", "light")
  const calls = await chat(page, { reply: "Logged." })

  await pick(page)
  await page.getByRole("button", { name: /receipt\.jpg/ }).click()
  await expect(attachment(page).getByRole("listitem")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled()

  await composer(page).fill("lunch 50rb")
  await composer(page).press("Enter")
  await expect(log(page).getByText("Logged.")).toBeVisible()
  expect(uploads(calls)).toHaveLength(0)
  expect(chats(calls)).toEqual([{ message: "lunch 50rb", clientDate: "2026-11-25" }])
})

test("takes a photo dropped anywhere over the conversation", async ({ page }) => {
  await showAs(page, "desktop", "light")
  await chat(page, { history: [message("m1", "user", "buy cloth 70rb")] })
  await expect(log(page).getByText("buy cloth 70rb")).toBeVisible()

  const dataTransfer = await dragOver(page, log(page), "dropped.jpg")
  await expect(page.getByText("Drop the receipt to attach it")).toBeVisible()
  await screenshot(page, "w14", "drop-desktop-light")
  await log(page).dispatchEvent("drop", { dataTransfer })

  await expect(page.getByText("Drop the receipt to attach it")).toBeHidden()
  await expect(attachment(page).getByText("dropped.jpg")).toBeVisible()
})

test("takes a photo pasted into the message", async ({ page }) => {
  await showAs(page, "desktop", "light")
  await chat(page)

  const dataTransfer = await transfer(page, "pasted.png", thumbnail, "image/png")
  await composer(page).evaluate((textarea, clipboardData) => {
    textarea.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
    )
  }, dataTransfer)

  await expect(attachment(page).getByText("pasted.png")).toBeVisible()
})

test("refuses a file that is not a photo, and says so", async ({ page }) => {
  await showAs(page, "desktop", "light")
  await chat(page)

  const dataTransfer = await transfer(
    page,
    "statement.pdf",
    Buffer.from("%PDF-1.4"),
    "application/pdf",
  )
  const main = page.getByRole("main")
  await main.dispatchEvent("dragenter", { dataTransfer })
  await main.dispatchEvent("dragover", { dataTransfer })
  await main.dispatchEvent("drop", { dataTransfer })

  await expect(page.getByRole("alert")).toHaveText("Attach a JPEG, PNG or WebP photo.")
  await expect(attachment(page).getByRole("listitem")).toHaveCount(0)
})

test("an unreadable photo still yields a Draft to fill in", async ({ page }) => {
  await showAs(page, "desktop", "light")
  await chat(page, {
    rows: [unreadable],
    reply: fenced("I couldn't read that receipt. Fill in the amount.", card(unreadable.id)),
  })

  await pick(page, "blurry.jpg")
  await page.getByRole("button", { name: "Send" }).click()

  const draftCardEl = draftCard(page, "Rp0")
  await expect(draftCardEl.getByText("Check amount")).toBeVisible()
  await expect(draftCardEl.getByRole("img", { name: "Receipt" })).toBeVisible()
  await expect(draftCardEl.getByRole("button", { name: "Edit merchant" })).toBeVisible()
  await expect(draftCardEl.getByText("Other")).toBeVisible()
  await screenshot(page, "w14", "unreadable-desktop-light")
})

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`a Receipt from the composer to the Draft card, ${viewport}, ${theme}`, async ({
      page,
    }) => {
      await showAs(page, viewport, theme)
      await chat(page, {
        history: [
          message("m1", "user", "buy cloth 70rb"),
          message("m2", "assistant", "", card(uniqlo.id)),
        ],
      })
      await expect(draftCard(page, "Rp70.000")).toBeVisible()

      await pick(page)
      await composer(page).fill("here's the indomaret one")
      await expect(attachment(page).getByText("receipt.jpg")).toBeVisible()
      await page.mouse.move(0, 0)
      await screenshot(page, "w14", `composer-${viewport}-${theme}`)

      await composer(page).press("Enter")
      const indomaretCard = draftCard(page, "Rp146.500")
      await expect(indomaretCard.getByText("Check amount")).toBeVisible()
      const image = indomaretCard.getByRole("img", { name: "Receipt" })
      await expect(image).toBeVisible()
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
      await page.mouse.move(0, 0)
      await screenshot(page, "w14", `chat-${viewport}-${theme}`)

      await indomaretCard.getByRole("button", { name: "Open receipt photo" }).click()
      const dialog = page.getByRole("dialog", { name: "Receipt" })
      await expect(dialog).toBeVisible()
      const full = dialog.getByRole("img", { name: "Receipt" })
      await expect
        .poll(() => full.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
      await screenshot(page, "w14", `photo-${viewport}-${theme}`)
      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden()
      await expect(indomaretCard.getByRole("button", { name: "Open receipt photo" })).toBeFocused()
    })
  }
}

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`a reloaded Chat still shows the Receipt in the user's message, ${viewport}, ${theme}`, async ({
      page,
    }) => {
      await showAs(page, viewport, theme)
      await chat(page, {
        history: [
          message("m1", "user", "tadi pagi", null, "rk-indomaret"),
          message("m2", "assistant", "Logged it from your receipt.", card(indomaret.id)),
          message("m3", "user", "Here's a receipt.", null, "rk-superindo"),
          message("m4", "assistant", "Got it.", null),
        ],
      })

      const mine = log(page).getByRole("article", { name: "You" })
      await expect(mine).toHaveCount(2)
      await expect(mine.nth(0).getByText("tadi pagi")).toBeVisible()
      // A Receipt sent with no words shows only the photo.
      await expect(mine.nth(1).getByText("Here's a receipt.")).toHaveCount(0)
      await Promise.all(
        (await mine.all()).map((bubble) =>
          expect
            .poll(() =>
              bubble
                .getByRole("img", { name: "Receipt" })
                .evaluate((img: HTMLImageElement) => img.naturalWidth),
            )
            .toBeGreaterThan(0),
        ),
      )
      await expect(draftCard(page, "Rp146.500")).toBeVisible()
      await page.mouse.move(0, 0)
      await screenshot(page, "w14", `history-${viewport}-${theme}`)

      await mine.nth(0).getByRole("button", { name: "Open receipt photo" }).click()
      await expect(page.getByRole("dialog", { name: "Receipt" })).toBeVisible()
    })
  }
}

// The design's list (docs/design/design.pen, "Expense List"), two of them from Receipts.
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
    receiptKey: "rk-indomaret",
  }),
  expense({
    id: "e5",
    merchant: "Kopi Kenangan",
    categoryId: 2,
    amount: 32000,
    occurredAt: "2026-11-21",
  }),
  expense({
    id: "e7",
    merchant: "Superindo",
    categoryId: 1,
    amount: 412300,
    occurredAt: "2026-11-19",
    receiptKey: "rk-superindo",
  }),
  expense({
    id: "e8",
    merchant: "PLN token",
    categoryId: 4,
    amount: 200000,
    occurredAt: "2026-11-18",
  }),
]

const report: Report = {
  from: "2026-11-01",
  to: "2026-11-30",
  groupBy: "category",
  total: 903800,
  totals: [],
}

const openList = async (page: Page) => {
  await page.clock.setFixedTime(new Date("2026-11-26T03:00:00Z"))
  await mockApi(page, { "GET /api/expenses": ok(november), "GET /api/reports": ok(report) })
  await page.goto("/expenses")
  const rows = page.getByRole("list", { name: "Expenses" }).getByRole("listitem")
  await expect(rows).toHaveCount(november.length)
  return rows
}

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`the list marks Expenses with a Receipt, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      const rows = await openList(page)

      const marked = rows.filter({ has: page.getByRole("img", { name: "Has receipt" }) })
      await expect(marked).toHaveCount(2)
      await expect(marked.nth(0)).toContainText("Indomaret")
      await expect(marked.nth(1)).toContainText("Superindo")
      await screenshot(page, "w14", `list-${viewport}-${theme}`)
    })
  }

  test(`the mobile row sheet marks the Receipt, ${viewport === "mobile" ? "light" : "dark"}`, async ({
    page,
  }) => {
    await showAs(page, "mobile", viewport === "mobile" ? "light" : "dark")
    const rows = await openList(page)

    await rows.filter({ hasText: "Indomaret" }).click()
    const sheet = page.getByRole("menu")
    await expect(sheet.getByRole("img", { name: "Has receipt" })).toBeVisible()
    await page.waitForTimeout(400)
    await screenshot(page, "w14", `sheet-mobile-${viewport === "mobile" ? "light" : "dark"}`)
  })
}
