import { EditExpense, Expense } from "@expense/contract"
import { Schema } from "effect"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { fail, fakeApi, ok } from "../../shared/testing/fakeApi.ts"
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

  it("corrects the Category from the chip's ✎", async () => {
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
