import { EditExpense, Expense } from "@expense/contract"
import { Schema } from "effect"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { fail, fakeApi, type FakeHandler, ok } from "../../shared/testing/fakeApi.ts"
import { expensesKey } from "../../shared/api/queryKeys.ts"
import { GeneratedUi } from "./GeneratedUi.tsx"

const readEdit = Schema.decodeUnknownSync(EditExpense)
const readExpense = Schema.decodeUnknownSync(Expense)
/** The Expense after a PATCH body, as the server would save it. */
const applyEdit = (expense: Expense, body: unknown): Expense =>
  readExpense({ ...expense, ...readEdit(body) })

const draft = (overrides: Partial<Expense> = {}): Expense => ({
  id: "d1",
  amount: 70000,
  categoryId: 6,
  merchant: "Uniqlo",
  note: null,
  occurredAt: "2026-11-24",
  createdAt: "2026-11-24T03:00:00.000Z",
  status: "draft",
  needsReview: false,
  receiptKey: null,
  ...overrides,
})

const program = (...ids: ReadonlyArray<string>) =>
  `root = Stack([${ids.map((_, i) => `c${i}`).join(", ")}])\n${ids
    .map((id, i) => `c${i} = DraftExpenseCard("${id}")`)
    .join("\n")}`

/**
 * A server holding Drafts by id; confirm, discard and edit change what it
 * serves next. Moves wait for `hold` before answering.
 */
const server = (
  initial: ReadonlyArray<Expense>,
  overrides: Readonly<Record<string, FakeHandler>> = {},
  hold: Promise<void> = Promise.resolve(),
) => {
  const rows = new Map(initial.map((expense) => [expense.id, expense]))
  const routes: Record<string, FakeHandler> = { "GET /api/expenses": ok([]) }
  for (const { id } of initial) {
    const move = (status: Expense["status"]) => async () => {
      await hold
      const moved = { ...rows.get(id)!, status }
      rows.set(id, moved)
      return ok(moved)
    }
    routes[`GET /api/expenses/${id}`] = () => ok(rows.get(id))
    routes[`POST /api/expenses/${id}/confirm`] = move("confirmed")
    routes[`POST /api/expenses/${id}/discard`] = move("discarded")
    routes[`PATCH /api/expenses/${id}`] = (call) => {
      const edited = applyEdit(rows.get(id)!, call.body)
      rows.set(id, edited)
      return ok(edited)
    }
  }
  return { rows, ...fakeApi({ ...routes, ...overrides }) }
}

const show = (ids: ReadonlyArray<string> = ["d1"], client = new QueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <GeneratedUi program={program(...ids)} streaming={false} />
    </QueryClientProvider>,
  )

const findCard = (amount = "Rp70.000") =>
  screen.findByRole("article", { name: `Draft Expense ${amount}` })

const sent = (calls: ReadonlyArray<{ method: string; path: string }>, method: string) =>
  calls.filter((call) => call.method === method).map((call) => call.path)

describe("the Draft Expense card", () => {
  it("shows the Draft and confirms it with one API call, never the model", async () => {
    const { calls } = server([draft()])
    show()

    const card = await screen.findByRole("article", { name: "Draft Expense Rp70.000" })
    expect(card).toHaveTextContent("Uniqlo · 24 Nov 2026")
    expect(within(card).getByRole("combobox", { name: "Edit category" })).toHaveTextContent(
      "Shopping",
    )

    await userEvent.dblClick(within(card).getByRole("button", { name: "Confirm" }))

    expect(await within(card).findByText("Confirmed")).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: "Confirm" })).toBeNull()
    expect(sent(calls, "POST")).toEqual(["/api/expenses/d1/confirm"])
  })

  it("reads Confirming… with both buttons disabled while the confirm is in flight", async () => {
    const { promise: held, resolve: release } = Promise.withResolvers<void>()
    const { calls } = server([draft()], {}, held)
    show()
    const card = await findCard()

    await userEvent.click(within(card).getByRole("button", { name: "Confirm" }))
    const confirming = within(card).getByRole("button", { name: "Confirming…" })
    expect(confirming).toBeDisabled()
    expect(within(card).getByRole("button", { name: "Discard" })).toBeDisabled()
    await userEvent.click(confirming)

    release()
    expect(await within(card).findByText("Confirmed")).toBeInTheDocument()
    expect(sent(calls, "POST")).toEqual(["/api/expenses/d1/confirm"])
  })

  it("flags a Draft the agent was unsure of with Check amount", async () => {
    server([draft({ needsReview: true })])
    show()

    expect(within(await findCard()).getByText("Check amount")).toBeInTheDocument()
  })

  it("shows the Receipt's photo, and opens it full-screen when tapped", async () => {
    server([draft({ needsReview: true, receiptKey: "rk 1" })])
    show()

    const card = await findCard()
    const thumbnail = within(card).getByRole("img", { name: "Receipt" })
    expect(thumbnail).toHaveAttribute("src", "/api/receipts/rk%201")

    await userEvent.click(within(card).getByRole("button", { name: "Open receipt photo" }))

    const dialog = await screen.findByRole("dialog", { name: "Receipt" })
    expect(within(dialog).getByRole("img", { name: "Receipt" })).toHaveAttribute(
      "src",
      "/api/receipts/rk%201",
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("has no photo when the Draft has no Receipt", async () => {
    server([draft()])
    show()

    expect(within(await findCard()).queryByRole("img", { name: "Receipt" })).toBeNull()
  })

  it("collapses a discarded Draft to one line", async () => {
    const { calls } = server([draft()])
    show()

    await userEvent.click(within(await findCard()).getByRole("button", { name: "Discard" }))

    expect(await screen.findByText("Discarded · Rp70.000 · Uniqlo")).toBeInTheDocument()
    expect(screen.queryByRole("article")).toBeNull()
    expect(sent(calls, "POST")).toEqual(["/api/expenses/d1/discard"])
  })

  it("says so when the Draft no longer exists", async () => {
    fakeApi({ "GET /api/expenses/gone": fail("EXPENSE_NOT_FOUND", { details: { id: "gone" } }) })
    show(["gone"])

    expect(await screen.findByText("This draft no longer exists")).toBeInTheDocument()
  })

  it("names the Draft when a confirm is refused", async () => {
    server([draft()], {
      "POST /api/expenses/d1/confirm": fail("EXPENSE_DISCARDED", { details: { id: "d1" } }),
    })
    show()

    await userEvent.click(within(await findCard()).getByRole("button", { name: "Confirm" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Uniqlo was discarded and can't be confirmed.",
    )
  })

  it("changes the Category from the chip's ✎", async () => {
    const { calls } = server([draft()])
    show()
    const card = await findCard()

    await userEvent.click(within(card).getByRole("combobox", { name: "Edit category" }))
    await userEvent.click(await screen.findByRole("option", { name: "Groceries" }))

    await waitFor(() =>
      expect(within(card).getByRole("combobox", { name: "Edit category" })).toHaveTextContent(
        "Groceries",
      ),
    )
    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
      { categoryId: 1 },
    ])
  })

  it("edits the amount in place: tap, type, Enter", async () => {
    const { calls } = server([draft()])
    show()

    await userEvent.click(within(await findCard()).getByRole("button", { name: "Edit amount" }))
    const input = screen.getByRole("textbox", { name: "amount" })
    await userEvent.clear(input)
    await userEvent.type(input, "75.000{Enter}")

    expect(await findCard("Rp75.000")).toBeInTheDocument()
    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
      { amount: 75000 },
    ])
  })

  it("keeps an amount it cannot read and says why, without saving", async () => {
    const { calls } = server([draft()])
    show()

    await userEvent.click(within(await findCard()).getByRole("button", { name: "Edit amount" }))
    const input = screen.getByRole("textbox", { name: "amount" })
    await userEvent.clear(input)
    await userEvent.type(input, "70,5{Enter}")

    expect(screen.getByRole("alert")).toHaveTextContent("Use whole Rupiah")
    await userEvent.keyboard("{Escape}")
    expect(within(await findCard()).getByRole("button", { name: "Edit amount" })).toBeVisible()
    expect(calls.filter((call) => call.method === "PATCH")).toEqual([])
  })

  it("edits the merchant and adds a note in place", async () => {
    const { calls } = server([draft()])
    show()
    const card = await findCard()

    await userEvent.click(within(card).getByRole("button", { name: "Edit merchant" }))
    const merchant = screen.getByRole("textbox", { name: "merchant" })
    await userEvent.clear(merchant)
    await userEvent.type(merchant, "Uniqlo Grand Indonesia{Enter}")
    await waitFor(() => expect(card).toHaveTextContent("Uniqlo Grand Indonesia · 24 Nov 2026"))

    await userEvent.click(within(card).getByRole("button", { name: "Edit note" }))
    await userEvent.type(screen.getByRole("textbox", { name: "note" }), "jacket{Enter}")
    await waitFor(() => expect(card).toHaveTextContent("jacket"))

    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
      { merchant: "Uniqlo Grand Indonesia" },
      { note: "jacket" },
    ])
  })

  it("keeps a card per Draft when several arrive in a row", async () => {
    server([draft(), draft({ id: "d2", amount: 25000, merchant: "Kopi Kenangan" })])
    show(["d1", "d2"])

    await userEvent.click(within(await findCard()).getByRole("button", { name: "Confirm" }))

    expect(await within(await findCard()).findByText("Confirmed")).toBeInTheDocument()
    const other = await findCard("Rp25.000")
    expect(within(other).getByRole("button", { name: "Confirm" })).toBeEnabled()
  })

  it("follows the agent's edits and discards, since it fetches by id", async () => {
    const { rows } = server([draft()])
    const client = new QueryClient()
    show(["d1"], client)
    await findCard()

    rows.set("d1", draft({ amount: 164500 }))
    await client.invalidateQueries({ queryKey: expensesKey })
    expect(await findCard("Rp164.500")).toBeInTheDocument()

    rows.set("d1", draft({ amount: 164500, status: "discarded" }))
    await client.invalidateQueries({ queryKey: expensesKey })
    expect(await screen.findByText("Discarded · Rp164.500 · Uniqlo")).toBeInTheDocument()
  })
})
