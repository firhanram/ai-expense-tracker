import { EditExpense, Expense } from "@expense/contract"
import { Schema } from "effect"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { fail, fakeApi, ok } from "../../shared/testing/fakeApi.ts"
import { addDays } from "../../shared/format/expenseDate.ts"
import { localToday } from "../../shared/format/localDate.ts"
import { formatDayMonthYear } from "../../shared/format/shortDate.ts"
import { useExpenseActions } from "../expenses/index.ts"
import { ExpenseCard } from "./ExpenseCard.tsx"

const readEdit = Schema.decodeUnknownSync(EditExpense)
const readExpense = Schema.decodeUnknownSync(Expense)
/** The Expense after a PATCH body, as the server would save it. */
const applyEdit = (expense: Expense, body: unknown): Expense =>
  readExpense({ ...expense, ...readEdit(body) })

const draft: Expense = {
  id: "d1",
  amount: 32000,
  categoryId: 6,
  merchant: "Kopi Kenangan",
  note: null,
  occurredAt: "2026-11-24",
  createdAt: "2026-11-24T03:00:00.000Z",
  status: "draft",
  needsReview: false,
  receiptKey: null,
}

const ConfirmButton = () => {
  const { confirm } = useExpenseActions()
  return (
    <button type="button" onClick={() => confirm(draft)}>
      Confirm
    </button>
  )
}

describe("the ExpenseCard", () => {
  it("shows a confirm still in flight as confirmed, like the lists do", async () => {
    const { promise: held, resolve: release } = Promise.withResolvers<void>()
    let stored = draft
    fakeApi({
      "GET /api/expenses/d1": () => ok(stored),
      "GET /api/expenses": ok([]),
      "POST /api/expenses/d1/confirm": async () => {
        await held
        stored = { ...draft, status: "confirmed" }
        return ok(stored)
      },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
        <ConfirmButton />
      </QueryClientProvider>,
    )
    const card = await screen.findByRole("article", { name: "Expense Rp32.000" })
    expect(within(card).getByText("Draft")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(within(card).getByText("Confirmed")).toBeInTheDocument()

    release()
    expect(
      await within(await screen.findByRole("article")).findByText("Confirmed"),
    ).toBeInTheDocument()
  })

  it("fetches the Expense by id, whatever its status", async () => {
    const { calls } = fakeApi({ "GET /api/expenses/d1": ok({ ...draft, status: "discarded" }) })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    const card = await screen.findByRole("article", { name: "Expense Rp32.000" })
    expect(within(card).getByText("Discarded")).toBeInTheDocument()
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(["GET /api/expenses/d1"])
  })

  it("shows a missing merchant as an empty slot beside the note", async () => {
    fakeApi({
      "GET /api/expenses/d1": ok({
        ...draft,
        status: "confirmed",
        merchant: null,
        note: "Makanan kucing",
      }),
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    const card = await screen.findByRole("article", { name: "Expense Rp32.000" })

    expect(within(card).getByRole("button", { name: "Edit note" })).toHaveTextContent(
      "Makanan kucing",
    )
    expect(within(card).getAllByText("Makanan kucing")).toHaveLength(1)
    expect(within(card).getByRole("button", { name: "Edit merchant" })).toHaveTextContent(
      "Merchant",
    )
  })

  it("corrects the Category from its chip", async () => {
    const confirmed = { ...draft, status: "confirmed" as const }
    let stored: Expense = confirmed
    const { calls } = fakeApi({
      "GET /api/expenses/d1": () => ok(stored),
      "PATCH /api/expenses/d1": (call) => {
        stored = applyEdit(stored, call.body)
        return ok(stored)
      },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    const card = await screen.findByRole("article", { name: "Expense Rp32.000" })

    await userEvent.click(within(card).getByRole("combobox", { name: "Edit category" }))
    await userEvent.click(await screen.findByRole("option", { name: "Dining" }))

    await waitFor(() =>
      expect(within(card).getByRole("combobox", { name: "Edit category" })).toHaveTextContent(
        "Dining",
      ),
    )
    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
      { categoryId: 2 },
    ])
  })

  it("edits the amount and merchant from their editors, like the Draft card", async () => {
    let stored: Expense = { ...draft, status: "confirmed" }
    const { calls } = fakeApi({
      "GET /api/expenses/d1": () => ok(stored),
      "PATCH /api/expenses/d1": (call) => {
        stored = applyEdit(stored, call.body)
        return ok(stored)
      },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    await screen.findByRole("article", { name: "Expense Rp32.000" })

    await userEvent.click(screen.getByRole("button", { name: "Edit amount" }))
    await userEvent.clear(screen.getByRole("textbox", { name: "amount" }))
    await userEvent.type(screen.getByRole("textbox", { name: "amount" }), "35.000{Enter}")
    const card = await screen.findByRole("article", { name: "Expense Rp35.000" })

    await userEvent.click(within(card).getByRole("button", { name: "Edit merchant" }))
    await userEvent.clear(within(card).getByRole("textbox", { name: "merchant" }))
    await userEvent.type(within(card).getByRole("textbox", { name: "merchant" }), "Fore{Enter}")
    expect(await within(card).findByRole("button", { name: "Edit merchant" })).toHaveTextContent(
      "Fore",
    )

    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
      { amount: 35000 },
      { merchant: "Fore" },
    ])
    expect(within(card).getByRole("button", { name: "Edit date" })).toBeInTheDocument()
  })

  it("re-dates the Expense from the date chip's quick picks in one tap", async () => {
    let stored: Expense = { ...draft, status: "confirmed" }
    const { calls } = fakeApi({
      "GET /api/expenses/d1": () => ok(stored),
      "PATCH /api/expenses/d1": (call) => {
        stored = applyEdit(stored, call.body)
        return ok(stored)
      },
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    const card = await screen.findByRole("article", { name: "Expense Rp32.000" })

    await userEvent.click(within(card).getByRole("button", { name: "Edit date" }))
    await userEvent.click(await screen.findByRole("button", { name: /^Yesterday/ }))

    const yesterday = addDays(localToday(), -1)
    await waitFor(() =>
      expect(within(card).getByRole("button", { name: "Edit date" })).toHaveTextContent(
        formatDayMonthYear(yesterday),
      ),
    )
    expect(calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([
      { occurredAt: yesterday },
    ])
  })

  it("does not edit a discarded Expense", async () => {
    fakeApi({ "GET /api/expenses/d1": ok({ ...draft, status: "discarded" }) })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    await screen.findByRole("article", { name: "Expense Rp32.000" })

    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull()
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.getByText("Kopi Kenangan")).toBeInTheDocument()
  })

  it("says so when the Expense is gone", async () => {
    fakeApi({ "GET /api/expenses/d1": fail("EXPENSE_NOT_FOUND", { details: { id: "d1" } }) })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExpenseCard id="d1" />
      </QueryClientProvider>,
    )
    expect(await screen.findByText("This expense no longer exists")).toBeInTheDocument()
  })
})
