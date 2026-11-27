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
