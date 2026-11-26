import type { Expense } from "@expense/contract"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { fakeApi, ok } from "../../shared/testing/fakeApi.ts"
import { useExpenseActions } from "../expenses/useExpenseActions.ts"
import { ExpenseCard } from "./ExpenseCard.tsx"

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
    const store = { drafts: [draft], confirmed: [] as Array<Expense> }
    fakeApi({
      "GET /api/expenses": (call) =>
        ok(
          call.query.get("status") === "draft"
            ? store.drafts
            : call.query.get("status") === "confirmed"
              ? store.confirmed
              : [],
        ),
      "POST /api/expenses/d1/confirm": async () => {
        await held
        const moved = { ...draft, status: "confirmed" as const }
        store.drafts = []
        store.confirmed = [moved]
        return ok(moved)
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
})
