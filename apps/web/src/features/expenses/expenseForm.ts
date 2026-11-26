import {
  type CreateExpense,
  ExpenseNotFound,
  IsoDate,
  Unauthorized,
  UnknownCategory,
  ValidationFailed,
} from "@expense/contract"
import { Schema } from "effect"
import { HttpClientError } from "effect/http"

/** What the user typed, as the inputs hold it. */
export interface ExpenseFormValues {
  readonly amount: string
  readonly categoryId: string | null
  readonly merchant: string
  readonly note: string
  readonly occurredAt: string
}

export type ExpenseField = "amount" | "categoryId" | "merchant" | "note" | "occurredAt"

/** A message per field that is wrong, plus `form` for what belongs to no one field. */
export type ExpenseFormErrors = Partial<Record<ExpenseField | "form", string>>

const fields: ReadonlySet<unknown> = new Set([
  "amount",
  "categoryId",
  "merchant",
  "note",
  "occurredAt",
])
const isField = (key: unknown): key is ExpenseField => fields.has(key)

const wholeRupiah = "Use whole Rupiah, like 70000, or -70000 for a refund"

/**
 * Whole Rupiah (ADR-0003) from what was typed: `70000`, `70.000` (dot
 * thousands, as Rupiah are written) or a leading minus for a refund.
 * Anything with a fraction is refused rather than rounded.
 */
export const parseAmount = (text: string): { amount: number } | { error: string } => {
  const typed = text.trim().replace(/^−/, "-")
  if (typed === "") return { error: "Enter an amount" }
  const digits = /^-?\d{1,3}(\.\d{3})+$/.test(typed) ? typed.replaceAll(".", "") : typed
  if (!/^-?\d+$/.test(digits)) return { error: wholeRupiah }
  const amount = Number(digits)
  return Number.isSafeInteger(amount) ? { amount } : { error: wholeRupiah }
}

const isIsoDate = Schema.is(IsoDate)
const optionalText = (text: string) => (text.trim() === "" ? null : text.trim())

/** The `POST /expenses` body, or what is wrong with the form. */
export const parseExpenseForm = (
  values: ExpenseFormValues,
): { readonly payload: CreateExpense } | { readonly errors: ExpenseFormErrors } => {
  const errors: { -readonly [K in keyof ExpenseFormErrors]: string } = {}
  const amount = parseAmount(values.amount)
  if ("error" in amount) errors.amount = amount.error
  if (values.categoryId === null) errors.categoryId = "Choose a Category"
  if (values.occurredAt === "") errors.occurredAt = "Pick a date"
  else if (!isIsoDate(values.occurredAt)) errors.occurredAt = "Use a date like 2026-11-24"

  if ("error" in amount || values.categoryId === null || errors.occurredAt !== undefined)
    return { errors }
  return {
    payload: {
      amount: amount.amount,
      categoryId: Number(values.categoryId),
      merchant: optionalText(values.merchant),
      note: optionalText(values.note),
      occurredAt: values.occurredAt,
    },
  }
}

/** Where a rejected `POST` or `PATCH /expenses` should show its message. */
export const errorsFromApi = (error: unknown): ExpenseFormErrors => {
  if (error instanceof ExpenseNotFound)
    return { form: "This expense no longer exists. It may have been deleted elsewhere." }
  if (error instanceof UnknownCategory)
    return { categoryId: "That Category no longer exists. Choose another." }
  if (error instanceof ValidationFailed) {
    const errors: { -readonly [K in keyof ExpenseFormErrors]: string } = {}
    for (const issue of error.issues) {
      const [where, field] = issue.path
      if (where === "payload" && isField(field)) errors[field] ??= issue.message
      else errors.form ??= `The server refused this expense: ${issue.message}`
    }
    return Object.keys(errors).length > 0 ? errors : { form: "The server refused this expense." }
  }
  if (error instanceof Unauthorized) return { form: "Not authorised. Check the API token." }
  if (HttpClientError.isHttpClientError(error))
    return { form: "Couldn't reach the server. Check the connection and try again." }
  return { form: "Couldn't save the expense. Try again." }
}
