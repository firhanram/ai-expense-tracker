import type { Expense } from "@expense/contract"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type FakeResponse, fail, fakeApi, ok } from "../../shared/testing/fakeApi.ts"
import { renderApp } from "../../shared/testing/renderApp.tsx"

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "exp-1",
  amount: 70000,
  categoryId: 6,
  merchant: "Uniqlo",
  note: null,
  occurredAt: "2026-11-24",
  createdAt: "2026-11-24T03:00:00.000Z",
  status: "confirmed",
  needsReview: false,
  receiptKey: null,
  ...overrides,
})
const draft = (overrides: Partial<Expense> = {}) => expense({ status: "draft", ...overrides })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T18:00:00Z") })
})

afterEach(() => {
  vi.useRealTimers()
})

const list = () => screen.getByRole("list", { name: "Expenses" })

const showDrafts = async () => {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("tab", { name: "Drafts" }))
  return user
}

describe("the Drafts view", () => {
  it("shows confirmed Expenses by default and the month's Drafts on request", async () => {
    const { calls } = fakeApi({
      "GET /api/expenses": (call) =>
        call.query.get("status") === "draft"
          ? ok([draft({ id: "d1", merchant: "Kopi Kenangan" })])
          : ok([expense({ id: "c1", merchant: "Uniqlo" })]),
    })
    await renderApp("/expenses")

    expect(await screen.findByText("Uniqlo")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Confirmed" })).toHaveAttribute("aria-selected", "true")

    await showDrafts()

    const row = within(list()).getByRole("listitem")
    expect(await within(row).findByText("Kopi Kenangan")).toBeInTheDocument()
    expect(within(row).getByText("Draft")).toBeInTheDocument()
    // Drafts are not money spent, so the header counts them instead of totalling them.
    expect(screen.getByText("1 draft")).toBeInTheDocument()
    expect(screen.queryByText("Rp70.000", { selector: "header *" })).not.toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Confirm Kopi Kenangan" })).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Discard Kopi Kenangan" })).toBeInTheDocument()
    const draftCalls = calls.filter((call) => call.query.get("status") === "draft")
    expect(Object.fromEntries(draftCalls.at(-1)?.query ?? [])).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
      status: "draft",
    })
  })

  it("counts the month's Drafts on their tab while Confirmed is showing", async () => {
    fakeApi({
      "GET /api/expenses": (call) =>
        call.query.get("status") === "draft"
          ? ok([draft({ id: "d1" }), draft({ id: "d2" })])
          : ok([expense({ id: "c1" })]),
    })
    await renderApp("/expenses")

    const tab = screen.getByRole("tab", { name: "Drafts" })
    expect(await within(tab).findByText("2")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Confirmed" })).toHaveAttribute("aria-selected", "true")
  })

  it("marks a Draft that came from a Receipt", async () => {
    fakeApi({
      "GET /api/expenses": (call) =>
        call.query.get("status") === "draft"
          ? ok([
              draft({ id: "d1", merchant: "Indomaret", receiptKey: "rk-1" }),
              draft({ id: "d2", merchant: "Kopi Kenangan" }),
            ])
          : ok([]),
    })
    await renderApp("/expenses")
    await showDrafts()

    await within(list()).findByText("Indomaret")
    const [fromReceipt, typed] = within(list()).getAllByRole("listitem")
    expect(within(fromReceipt!).getByRole("img", { name: "Has receipt" })).toBeInTheDocument()
    expect(within(typed!).queryByRole("img", { name: "Has receipt" })).toBeNull()
  })
})

/** A server whose confirm/discard answers wait until `release()`. */
const heldServer = (drafts: ReadonlyArray<Expense>, confirmed: ReadonlyArray<Expense> = []) => {
  const store = { drafts: [...drafts], confirmed: [...confirmed] }
  const { promise: held, resolve: release } = Promise.withResolvers<void>()
  const transition =
    (to: "confirmed" | "discarded", answer?: FakeResponse) =>
    async (call: { path: string }): Promise<FakeResponse> => {
      await held
      if (answer !== undefined) return answer
      const id = call.path.split("/")[3]
      const found = store.drafts.find((d) => d.id === id)
      if (found === undefined) return fail("EXPENSE_NOT_FOUND", { details: { id } })
      store.drafts = store.drafts.filter((d) => d.id !== id)
      const moved = { ...found, status: to }
      if (to === "confirmed") store.confirmed = [moved, ...store.confirmed]
      return ok(moved)
    }
  return {
    release,
    routes: (answers: { confirm?: FakeResponse; discard?: FakeResponse } = {}) => ({
      "GET /api/expenses": (call: { query: URLSearchParams }) =>
        ok(call.query.get("status") === "draft" ? store.drafts : store.confirmed),
      "POST /api/expenses/d1/confirm": transition("confirmed", answers.confirm),
      "POST /api/expenses/d1/discard": transition("discarded", answers.discard),
    }),
  }
}

const posts = (calls: ReadonlyArray<{ method: string; path: string }>) =>
  calls.filter((call) => call.method === "POST").map((call) => call.path)

describe("confirming a Draft", () => {
  it("moves it from Drafts to Confirmed at once, and keeps it there when the server agrees", async () => {
    const server = heldServer(
      [draft({ id: "d1", merchant: "Kopi Kenangan", amount: 32000 })],
      [expense({ id: "c1", merchant: "Uniqlo", occurredAt: "2026-11-20" })],
    )
    const { calls } = fakeApi(server.routes())
    await renderApp("/expenses")
    await screen.findByText("Uniqlo")
    const user = await showDrafts()

    await user.click(await screen.findByRole("button", { name: "Confirm Kopi Kenangan" }))

    expect(screen.queryByText("Kopi Kenangan")).not.toBeInTheDocument()
    expect(screen.getByText("No drafts in November 2026")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Confirmed" }))
    expect(
      within(list())
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["24 NovKopi KenanganShoppingRp32.000", "20 NovUniqloShoppingRp70.000"])

    server.release()
    await vi.waitFor(() => expect(posts(calls)).toEqual(["/api/expenses/d1/confirm"]))
    expect(await screen.findByText("Kopi Kenangan")).toBeInTheDocument()
    expect(screen.getByText("Rp102.000")).toBeInTheDocument()
  })

  it("sends one confirm for a double press", async () => {
    const server = heldServer([draft({ id: "d1", merchant: "Kopi Kenangan" })])
    const { calls } = fakeApi(server.routes())
    await renderApp("/expenses")
    const user = await showDrafts()

    await user.dblClick(await screen.findByRole("button", { name: "Confirm Kopi Kenangan" }))
    server.release()

    await vi.waitFor(() => expect(posts(calls)).toEqual(["/api/expenses/d1/confirm"]))
  })

  it("puts the Draft back and says so when the confirm fails", async () => {
    const server = heldServer([draft({ id: "d1", merchant: "Kopi Kenangan" })])
    fakeApi(server.routes({ confirm: fail("INTERNAL_ERROR") }))
    await renderApp("/expenses")
    const user = await showDrafts()

    await user.click(await screen.findByRole("button", { name: "Confirm Kopi Kenangan" }))
    expect(screen.queryByText("Kopi Kenangan")).not.toBeInTheDocument()
    server.release()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't confirm Kopi Kenangan. Try again.",
    )
    expect(within(list()).getByText("Kopi Kenangan")).toBeInTheDocument()
  })

  it("explains that a discarded Draft cannot be confirmed", async () => {
    const server = heldServer([draft({ id: "d1", merchant: "Kopi Kenangan" })])
    fakeApi(server.routes({ confirm: fail("EXPENSE_DISCARDED", { details: { id: "d1" } }) }))
    await renderApp("/expenses")
    const user = await showDrafts()

    await user.click(await screen.findByRole("button", { name: "Confirm Kopi Kenangan" }))
    server.release()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kopi Kenangan was discarded and can't be confirmed.",
    )
  })
})

describe("discarding a Draft", () => {
  it("drops it from Drafts at once and never lists it as confirmed", async () => {
    const server = heldServer([draft({ id: "d1", merchant: "Kopi Kenangan" })])
    const { calls } = fakeApi(server.routes())
    await renderApp("/expenses")
    await screen.findByText("No expenses in November 2026")
    const user = await showDrafts()

    await user.click(await screen.findByRole("button", { name: "Discard Kopi Kenangan" }))

    expect(screen.queryByText("Kopi Kenangan")).not.toBeInTheDocument()
    server.release()
    await vi.waitFor(() => expect(posts(calls)).toEqual(["/api/expenses/d1/discard"]))
    await user.click(screen.getByRole("tab", { name: "Confirmed" }))
    expect(await screen.findByText("No expenses in November 2026")).toBeInTheDocument()
  })

  it("puts the Draft back when the discard fails", async () => {
    const server = heldServer([draft({ id: "d1", merchant: "Kopi Kenangan" })])
    fakeApi(server.routes({ discard: fail("INTERNAL_ERROR") }))
    await renderApp("/expenses")
    const user = await showDrafts()

    await user.click(await screen.findByRole("button", { name: "Discard Kopi Kenangan" }))
    server.release()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't discard Kopi Kenangan. Try again.",
    )
    expect(within(list()).getByText("Kopi Kenangan")).toBeInTheDocument()
  })
})
