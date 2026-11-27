import { CreateExpense, type Expense } from "@expense/contract"
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Schema } from "effect"
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

beforeEach(() => {
  // 25 Nov 2026, 01:00 in Jakarta: still the 24th in UTC.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T18:00:00Z") })
})

afterEach(() => {
  vi.useRealTimers()
})

const rows = () => within(screen.getByRole("list", { name: "Expenses" })).getAllByRole("listitem")

describe("the Expense list", () => {
  it("asks for this month's confirmed Expenses on the user's clock", async () => {
    const { calls } = fakeApi({ "GET /api/expenses": ok([]) })

    await renderApp("/expenses")
    await screen.findByText("No expenses in November 2026")

    const lists = calls
      .filter((call) => call.path === "/api/expenses")
      .map((call) => Object.fromEntries(call.query))
    // The confirmed list, and the month's Drafts for the Drafts tab's count.
    expect(lists).toHaveLength(2)
    expect(lists).toContainEqual({ from: "2026-11-01", to: "2026-11-30" })
    expect(lists).toContainEqual({ from: "2026-11-01", to: "2026-11-30", status: "draft" })
  })

  it("shows each Expense as a row, in the order the API sends (newest date first)", async () => {
    fakeApi({
      "GET /api/expenses": ok([
        expense({ id: "a", merchant: "Uniqlo", occurredAt: "2026-11-24", amount: 70000 }),
        expense({
          id: "b",
          merchant: "Indomaret",
          categoryId: 1,
          occurredAt: "2026-11-22",
          amount: 146500,
        }),
      ]),
    })

    await renderApp("/expenses")
    await screen.findByText("Uniqlo")

    expect(rows().map((row) => row.textContent)).toEqual([
      "24 NovUniqloShoppingRp70.000",
      "22 NovIndomaretGroceriesRp146.500",
    ])
  })

  it("marks the Expenses that have a Receipt", async () => {
    fakeApi({
      "GET /api/expenses": ok([
        expense({ id: "a", merchant: "Uniqlo" }),
        expense({ id: "b", merchant: "Indomaret", receiptKey: "rk-1" }),
      ]),
    })

    await renderApp("/expenses")
    await screen.findByText("Indomaret")

    const [typed, fromReceipt] = rows()
    expect(within(fromReceipt!).getByRole("img", { name: "Has receipt" })).toBeInTheDocument()
    expect(within(typed!).queryByRole("img", { name: "Has receipt" })).toBeNull()
  })

  it("heads the list with the month and its total, refunds subtracted", async () => {
    fakeApi({
      "GET /api/expenses": ok([
        expense({ id: "a", amount: 200000 }),
        expense({ id: "b", merchant: "Tokopedia", amount: -50000 }),
      ]),
    })

    await renderApp("/expenses")

    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument()
    expect(screen.getByText("Rp150.000")).toBeInTheDocument()
    expect(screen.getByText("−Rp50.000")).toBeInTheDocument()
  })
})

const openForm = async () => {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: "Add expense" }))
  return { user, form: screen.getByRole("form", { name: "Add expense" }) }
}

const chooseCategory = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("combobox", { name: "Category" }))
  await user.click(await screen.findByRole("option", { name }))
}

describe("adding an Expense by hand", () => {
  it("posts the form, dated the user's today by default, and lists the new Expense", async () => {
    let stored: ReadonlyArray<Expense> = []
    const { calls } = fakeApi({
      "GET /api/expenses": () => ok(stored),
      "POST /api/expenses": (call) => {
        const body = Schema.decodeUnknownSync(CreateExpense)(call.body)
        stored = [
          expense({
            id: "new",
            amount: body.amount,
            categoryId: body.categoryId,
            merchant: body.merchant ?? null,
            note: body.note ?? null,
            occurredAt: body.occurredAt,
          }),
        ]
        return ok(stored[0], 201)
      },
    })
    await renderApp("/expenses")
    const { user, form } = await openForm()

    expect(within(form).getByLabelText("Date")).toHaveValue("2026-11-25")
    await user.type(within(form).getByLabelText("Amount"), "-70.000")
    await chooseCategory(user, "Shopping")
    await user.type(within(form).getByLabelText("Merchant"), "Uniqlo")
    await user.type(within(form).getByLabelText("Note"), "returned shirt")
    await user.click(within(form).getByRole("button", { name: "Add expense" }))

    expect(await screen.findByText("Uniqlo")).toBeInTheDocument()
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      amount: -70000,
      categoryId: 6,
      merchant: "Uniqlo",
      note: "returned shirt",
      occurredAt: "2026-11-25",
    })
    expect(screen.queryByRole("form", { name: "Add expense" })).not.toBeInTheDocument()
  })

  it("opens the form on N, but not while the user is typing somewhere", async () => {
    fakeApi({ "GET /api/expenses": ok([]) })
    await renderApp("/expenses")
    await screen.findByText("No expenses in November 2026")
    const user = userEvent.setup()

    await user.keyboard("n")
    const form = screen.getByRole("form", { name: "Add expense" })
    await user.type(within(form).getByLabelText("Merchant"), "n")
    expect(within(form).getByLabelText("Merchant")).toHaveValue("n")
  })

  it("refuses an amount that is not whole Rupiah, and a missing Category, without posting", async () => {
    const { calls } = fakeApi({ "GET /api/expenses": ok([]) })
    await renderApp("/expenses")
    const { user, form } = await openForm()

    await user.type(within(form).getByLabelText("Amount"), "12,5")
    await user.click(within(form).getByRole("button", { name: "Add expense" }))

    expect(within(form).getByLabelText("Amount")).toHaveAccessibleDescription(
      expect.stringContaining("Use whole Rupiah, like 70000"),
    )
    expect(within(form).getByText("Choose a Category")).toBeInTheDocument()
    expect(calls.filter((call) => call.method === "POST")).toEqual([])
  })

  it("shows the server's validation errors against their fields", async () => {
    fakeApi({
      "GET /api/expenses": ok([]),
      "POST /api/expenses": fail("VALIDATION_FAILED", {
        details: {
          issues: [{ path: ["payload", "occurredAt"], message: "Expected a date that exists" }],
        },
      }),
    })
    await renderApp("/expenses")
    const { user, form } = await openForm()

    await user.type(within(form).getByLabelText("Amount"), "15000")
    await chooseCategory(user, "Dining")
    await user.click(within(form).getByRole("button", { name: "Add expense" }))

    expect(await within(form).findByText("Expected a date that exists")).toBeInTheDocument()
    expect(screen.getByRole("form", { name: "Add expense" })).toBeInTheDocument()
  })

  it("shows an unknown Category against the Category field", async () => {
    fakeApi({
      "GET /api/expenses": ok([]),
      "POST /api/expenses": fail("UNKNOWN_CATEGORY", { details: { categoryId: 4 } }),
    })
    await renderApp("/expenses")
    const { user, form } = await openForm()

    await user.type(within(form).getByLabelText("Amount"), "15000")
    await chooseCategory(user, "Utilities")
    await user.click(within(form).getByRole("button", { name: "Add expense" }))

    expect(
      await within(form).findByText("That Category no longer exists. Choose another."),
    ).toBeInTheDocument()
  })
})
