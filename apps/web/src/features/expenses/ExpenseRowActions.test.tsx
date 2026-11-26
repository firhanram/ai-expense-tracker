import type { Expense } from "@expense/contract"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fail, fakeApi, ok } from "../../shared/testing/fakeApi.ts"
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

const uniqlo = expense({ id: "a" })
const indomaret = expense({
  id: "b",
  merchant: "Indomaret",
  categoryId: 1,
  amount: 146500,
  occurredAt: "2026-11-22",
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T18:00:00Z") })
})

afterEach(() => {
  vi.useRealTimers()
})

const list = () => screen.getByRole("list", { name: "Expenses" })
const row = (text: string) =>
  within(list())
    .getAllByRole("listitem")
    .find((item) => item.textContent.includes(text))

const chooseAction = async (
  user: ReturnType<typeof userEvent.setup>,
  rowName: string,
  action: "Edit" | "Delete",
) => {
  await user.click(await screen.findByRole("button", { name: `Actions for ${rowName}` }))
  await user.click(await screen.findByRole("menuitem", { name: action }))
}

describe("the row menu", () => {
  it("is named per row and offers Edit and Delete", async () => {
    fakeApi({ "GET /api/expenses": ok([uniqlo, indomaret]) })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await user.click(await screen.findByRole("button", { name: "Actions for Indomaret, 22 Nov" }))

    const menu = await screen.findByRole("menu")
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Edit", "Delete"])
  })
})

describe("editing an Expense", () => {
  it("opens the form filled with the Expense, patches it and shows the change", async () => {
    let stored: ReadonlyArray<Expense> = [uniqlo, indomaret]
    const { calls } = fakeApi({
      "GET /api/expenses": () => ok(stored),
      "PATCH /api/expenses/b": () => {
        const edited = { ...indomaret, amount: 150000, note: "weekly shop" }
        stored = [uniqlo, edited]
        return ok(edited)
      },
    })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Indomaret, 22 Nov", "Edit")
    const form = screen.getByRole("form", { name: "Edit expense" })
    expect(within(form).getByLabelText("Amount")).toHaveValue("146500")
    expect(within(form).getByLabelText("Merchant")).toHaveValue("Indomaret")
    expect(within(form).getByLabelText("Date")).toHaveValue("2026-11-22")
    expect(within(form).getByRole("combobox", { name: "Category" })).toHaveTextContent("Groceries")

    await user.clear(within(form).getByLabelText("Amount"))
    await user.type(within(form).getByLabelText("Amount"), "150.000")
    await user.type(within(form).getByLabelText("Note"), "weekly shop")
    await user.click(within(form).getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Rp150.000")).toBeInTheDocument()
    expect(screen.queryByRole("form", { name: "Edit expense" })).not.toBeInTheDocument()
    expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
      amount: 150000,
      categoryId: 1,
      merchant: "Indomaret",
      note: "weekly shop",
      occurredAt: "2026-11-22",
    })
  })

  it("leaves the Expense as it was on Cancel", async () => {
    const { calls } = fakeApi({ "GET /api/expenses": ok([uniqlo, indomaret]) })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Uniqlo, 24 Nov", "Edit")
    const form = screen.getByRole("form", { name: "Edit expense" })
    await user.click(within(form).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("form", { name: "Edit expense" })).not.toBeInTheDocument()
    expect(row("Uniqlo")?.textContent).toBe("24 NovUniqloShoppingRp70.000")
    expect(calls.filter((call) => call.method === "PATCH")).toEqual([])
  })

  it("shows the server's validation errors against their fields", async () => {
    fakeApi({
      "GET /api/expenses": ok([uniqlo]),
      "PATCH /api/expenses/a": fail("VALIDATION_FAILED", {
        details: {
          issues: [{ path: ["payload", "occurredAt"], message: "Expected a date that exists" }],
        },
      }),
    })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Uniqlo, 24 Nov", "Edit")
    const form = screen.getByRole("form", { name: "Edit expense" })
    await user.click(within(form).getByRole("button", { name: "Save" }))

    expect(await within(form).findByText("Expected a date that exists")).toBeInTheDocument()
    expect(within(form).getByLabelText("Date")).toHaveAccessibleDescription(
      expect.stringContaining("Expected a date that exists"),
    )
  })

  it("refuses a bad amount without patching", async () => {
    const { calls } = fakeApi({ "GET /api/expenses": ok([uniqlo]) })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Uniqlo, 24 Nov", "Edit")
    const form = screen.getByRole("form", { name: "Edit expense" })
    await user.clear(within(form).getByLabelText("Amount"))
    await user.click(within(form).getByRole("button", { name: "Save" }))

    expect(within(form).getByText("Enter an amount")).toBeInTheDocument()
    expect(calls.filter((call) => call.method === "PATCH")).toEqual([])
  })

  it("says so when the Expense no longer exists, and drops it from the list on close", async () => {
    let stored: ReadonlyArray<Expense> = [uniqlo, indomaret]
    fakeApi({
      "GET /api/expenses": () => ok(stored),
      "PATCH /api/expenses/a": () => {
        stored = [indomaret]
        return fail("EXPENSE_NOT_FOUND", { details: { id: "a" } })
      },
    })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Uniqlo, 24 Nov", "Edit")
    const form = screen.getByRole("form", { name: "Edit expense" })
    await user.click(within(form).getByRole("button", { name: "Save" }))

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "This expense no longer exists. It may have been deleted elsewhere.",
    )
    await user.click(within(form).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(row("Uniqlo")).toBeUndefined())
    expect(row("Indomaret")).toBeDefined()
  })
})

describe("deleting an Expense", () => {
  it("asks in the row, keeping the amount visible, and No keeps it", async () => {
    const { calls } = fakeApi({ "GET /api/expenses": ok([uniqlo, indomaret]) })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Indomaret, 22 Nov", "Delete")

    const confirming = row("Indomaret")
    expect(confirming).toBeDefined()
    expect(confirming?.textContent).toContain("Rp146.500")
    expect(confirming?.textContent).toContain("Delete?")
    expect(
      within(confirming ?? document.body).queryByRole("button", {
        name: "Actions for Indomaret, 22 Nov",
      }),
    ).not.toBeInTheDocument()
    expect(within(confirming ?? document.body).getByRole("button", { name: "No" })).toHaveFocus()

    await user.click(within(confirming ?? document.body).getByRole("button", { name: "No" }))

    expect(row("Indomaret")?.textContent).toBe("22 NovIndomaretGroceriesRp146.500")
    expect(screen.getByRole("button", { name: "Actions for Indomaret, 22 Nov" })).toHaveFocus()
    expect(calls.filter((call) => call.method === "DELETE")).toEqual([])
  })

  it("deletes on Yes and the row disappears", async () => {
    let stored: ReadonlyArray<Expense> = [uniqlo, indomaret]
    const { calls } = fakeApi({
      "GET /api/expenses": () => ok(stored),
      "DELETE /api/expenses/b": () => {
        stored = [uniqlo]
        return ok(null)
      },
    })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Indomaret, 22 Nov", "Delete")
    await user.click(
      within(row("Indomaret") ?? document.body).getByRole("button", {
        name: "Yes, delete Indomaret",
      }),
    )

    await waitFor(() => expect(row("Indomaret")).toBeUndefined())
    expect(calls.filter((call) => call.method === "DELETE").map((call) => call.path)).toEqual([
      "/api/expenses/b",
    ])
  })

  it("treats an Expense already gone as deleted", async () => {
    let stored: ReadonlyArray<Expense> = [uniqlo, indomaret]
    fakeApi({
      "GET /api/expenses": () => ok(stored),
      "DELETE /api/expenses/b": () => {
        stored = [uniqlo]
        return fail("EXPENSE_NOT_FOUND", { details: { id: "b" } })
      },
    })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Indomaret, 22 Nov", "Delete")
    await user.click(screen.getByRole("button", { name: "Yes, delete Indomaret" }))

    await waitFor(() => expect(row("Indomaret")).toBeUndefined())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps the row and says so when the delete fails", async () => {
    fakeApi({
      "GET /api/expenses": ok([uniqlo]),
      "DELETE /api/expenses/a": fail("INTERNAL_ERROR"),
    })
    await renderApp("/expenses")
    const user = userEvent.setup()

    await chooseAction(user, "Uniqlo, 24 Nov", "Delete")
    await user.click(screen.getByRole("button", { name: "Yes, delete Uniqlo" }))

    expect(await within(row("Uniqlo") ?? document.body).findByRole("alert")).toHaveTextContent(
      "Couldn't delete",
    )
    expect(screen.getByRole("button", { name: "Yes, delete Uniqlo" })).toBeInTheDocument()
  })
})
