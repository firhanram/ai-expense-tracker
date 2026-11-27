import { type EditExpense, IsoDate } from "@expense/contract"
import { Schema } from "effect"
import { parseAmount } from "../../shared/format/amount.ts"

const isIsoDate = Schema.is(IsoDate)

const optionalText = (typed: string) => (typed.trim() === "" ? null : typed.trim())

/** What a card's inline fields send: the edit, or what is wrong with what was typed. */
export const edits = {
  amount: (typed: string): EditExpense | string => {
    const parsed = parseAmount(typed)
    return "error" in parsed ? parsed.error : { amount: parsed.amount }
  },
  merchant: (typed: string): EditExpense => ({ merchant: optionalText(typed) }),
  note: (typed: string): EditExpense => ({ note: optionalText(typed) }),
  occurredAt: (typed: string): EditExpense | string =>
    isIsoDate(typed) ? { occurredAt: typed } : "Pick a date",
}
