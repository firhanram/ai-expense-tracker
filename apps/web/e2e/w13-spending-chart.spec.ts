import type { ChatMessage, Report } from "@expense/contract"
import { expect, type Page, test } from "@playwright/test"
import { type ApiCall, type MockHandler, mockApi, ok, stream } from "./support/api.ts"
import { screenshot, showAs, themes } from "./support/screenshot.ts"

const now = new Date("2026-11-25T10:00:00+07:00")

/** The design's November 2026 chart (sCh8X.png), in Category order as the server sends it. */
const november: Report = {
  from: "2026-11-01",
  to: "2026-11-30",
  groupBy: "category",
  total: 2_480_000,
  totals: [
    { label: "Groceries", categoryId: 1, amount: 980_000 },
    { label: "Dining", categoryId: 2, amount: 612_500 },
    { label: "Transport", categoryId: 3, amount: 187_500 },
    { label: "Utilities", categoryId: 4, amount: 200_000 },
    { label: "Shopping", categoryId: 6, amount: 310_000 },
    { label: "Health", categoryId: 7, amount: 85_000 },
    { label: "Entertainment", categoryId: 8, amount: 54_000 },
    { label: "Giving & family", categoryId: 10, amount: 51_000 },
  ],
}

const byMonth: Report = {
  from: "2026-06-01",
  to: "2026-11-30",
  groupBy: "month",
  total: 11_180_000,
  totals: [
    { label: "2026-06", categoryId: null, amount: 1_850_000 },
    { label: "2026-07", categoryId: null, amount: 2_210_000 },
    { label: "2026-08", categoryId: null, amount: 1_640_000 },
    { label: "2026-09", categoryId: null, amount: 1_920_000 },
    { label: "2026-10", categoryId: null, amount: -120_000 },
    { label: "2026-11", categoryId: null, amount: 2_480_000 },
  ],
}

const withRefund: Report = {
  from: "2026-11-20",
  to: "2026-11-24",
  groupBy: "category",
  total: 95_000,
  totals: [
    { label: "Dining", categoryId: 2, amount: 70_000 },
    { label: "Shopping", categoryId: 6, amount: -25_000 },
    { label: "Other", categoryId: 11, amount: 50_000 },
  ],
}

const empty: Report = { ...november, from: "2026-10-01", to: "2026-10-31", total: 0, totals: [] }

const reports = [november, byMonth, withRefund, empty]

/** `GET /api/reports`, answered from the fixtures by range and grouping. */
const getReport = (call: ApiCall) =>
  ok(
    reports.find(
      (report) =>
        report.from === call.query.get("from") &&
        report.to === call.query.get("to") &&
        report.groupBy === call.query.get("groupBy"),
    ) ?? empty,
  )

/** A streamed reply: prose, then a program whose root stacks `charts` (name = SpendingChart(...)). */
const reply = (text: string, charts: Readonly<Record<string, string>>) =>
  stream(
    [
      text,
      "",
      "```openui-lang",
      `root = Stack([${Object.keys(charts).join(", ")}])`,
      ...Object.entries(charts).map(([name, args]) => `${name} = SpendingChart(${args})`),
      "```",
    ].join("\n"),
  )

const noHistory = ok({ messages: [] as ReadonlyArray<ChatMessage>, nextBefore: null })

const open = async (page: Page, answer: MockHandler, reportsHandler: MockHandler = getReport) => {
  await mockApi(page, {
    "GET /api/chat": noHistory,
    "GET /api/reports": reportsHandler,
    "POST /api/chat": answer,
  })
  await page.clock.setFixedTime(now)
  await page.goto("/")
}

const ask = async (page: Page, text: string) => {
  const composer = page.getByRole("textbox", { name: "Message" })
  await composer.fill(text)
  await composer.press("Enter")
}

const novemberReply = reply(
  "You've spent Rp2.480.000 so far in November. Groceries is the largest share, at about 40%.",
  { chart: '"2026-11-01", "2026-11-30", "category", "bar"' },
)

for (const viewport of ["desktop", "mobile"] as const) {
  for (const theme of themes) {
    test(`category chart, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await open(page, novemberReply)
      await ask(page, "report of my expenses this month")

      const chart = page.getByRole("figure", { name: "November 2026 by category" })
      await expect(chart).toBeVisible()
      await expect(chart.getByText("Rp2.480.000")).toBeVisible()
      // Largest first; the text alternative reads in the same order as the bars.
      await expect(chart.getByRole("listitem")).toHaveText([
        "Groceries: Rp980.000",
        "Dining: Rp612.500",
        "Shopping: Rp310.000",
        "Utilities: Rp200.000",
        "Transport: Rp187.500",
        "Health: Rp85.000",
        "Entertainment: Rp54.000",
        "Giving & family: Rp51.000",
      ])
      await expect(chart.locator("svg text", { hasText: "980.000" })).toBeVisible()
      await screenshot(chart, "w13", `category-${viewport}-${theme}`)
      await screenshot(page, "w13", `chat-${viewport}-${theme}`)
    })

    test(`month charts as bars and as a line, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await open(
        page,
        reply("Here are the last six months.", {
          bars: '"2026-06-01", "2026-11-30", "month", "bar"',
          line: '"2026-06-01", "2026-11-30", "month", "line"',
        }),
      )
      await ask(page, "how did my spending change since june")

      const charts = page.getByRole("figure", { name: "June – November 2026 by month" })
      await expect(charts).toHaveCount(2)
      // Months stay in time order, refunds and all.
      await expect(charts.first().getByRole("listitem")).toHaveText([
        "Jun 2026: Rp1.850.000",
        "Jul 2026: Rp2.210.000",
        "Aug 2026: Rp1.640.000",
        "Sept 2026: Rp1.920.000",
        "Oct 2026: −Rp120.000",
        "Nov 2026: Rp2.480.000",
      ])
      await expect(charts.first().locator("svg text", { hasText: "Nov" }).first()).toBeVisible()
      await expect(charts.nth(1).locator("svg path.recharts-line-curve")).toBeVisible()
      await screenshot(charts.first(), "w13", `month-bar-${viewport}-${theme}`)
      // Clear of the fixed composer before the element shot.
      await charts.nth(1).evaluate((chart) => chart.scrollIntoView({ block: "center" }))
      await screenshot(charts.nth(1), "w13", `month-line-${viewport}-${theme}`)
    })

    test(`refund and empty range, ${viewport}, ${theme}`, async ({ page }) => {
      await showAs(page, viewport, theme)
      await open(
        page,
        reply("The refund week, and October.", {
          week: '"2026-11-20", "2026-11-24", "category", "bar"',
          october: '"2026-10-01", "2026-10-31", "category", "bar"',
        }),
      )
      await ask(page, "what about the refund week and october")

      const chart = page.getByRole("figure", { name: "20–24 Nov 2026 by category" })
      await expect(chart).toBeVisible()
      await expect(chart.getByRole("listitem")).toHaveText([
        "Dining: Rp70.000",
        "Other: Rp50.000",
        "Shopping: −Rp25.000",
      ])
      await expect(chart.locator("svg text", { hasText: "−25.000" })).toBeVisible()
      await expect(page.getByText("No expenses in this range")).toBeVisible()
      await screenshot(chart, "w13", `refund-${viewport}-${theme}`)
    })
  }
}

test("grows once on mount and does not animate again when the figures refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  let fetches = 0
  // The refetch halves Groceries, so Dining becomes the largest bar.
  const refreshing = () => {
    fetches += 1
    if (fetches === 1) return ok(november)
    return ok({
      ...november,
      totals: [
        { label: "Groceries", categoryId: 1, amount: 490_000 },
        ...november.totals.filter((total) => total.categoryId !== 1),
      ],
    })
  }
  await open(page, novemberReply, refreshing)
  await ask(page, "report of my expenses this month")

  const chart = page.getByRole("figure", { name: "November 2026 by category" })
  const firstBar = chart.locator("svg .recharts-bar-rectangle rect").first()
  const width = async () => (await firstBar.boundingBox())?.width ?? 0
  await expect.poll(width).toBeGreaterThan(400)

  // Regaining focus refetches; the new figures replace the old at once, without growing.
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"))
    window.dispatchEvent(new Event("focus"))
  })
  await expect(chart.getByRole("listitem").first()).toHaveText("Dining: Rp612.500")
  const settled = await width()
  await page.waitForTimeout(400)
  expect(await width()).toBe(settled)
})
