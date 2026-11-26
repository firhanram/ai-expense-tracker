import type { Expense } from "@expense/contract"

/** A confirmed Expense as the API sends it; override what the test is about. */
export const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: "exp-1",
  amount: 70000,
  categoryId: 8,
  merchant: "Uniqlo",
  note: null,
  occurredAt: "2026-11-24",
  createdAt: "2026-11-24T03:00:00.000Z",
  status: "confirmed",
  needsReview: false,
  receiptKey: null,
  ...overrides,
})

/** The same Expense as a Draft, as a rendered card fetches it. */
export const draft = (overrides: Partial<Expense> = {}): Expense =>
  expense({ status: "draft", ...overrides })
