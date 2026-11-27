const wholeRupiah = "Use whole Rupiah, like 70000, or -70000 for a refund"

const thousands: Readonly<Record<string, number>> = { rb: 1_000, k: 1_000, jt: 1_000_000 }

/**
 * Whole Rupiah (ADR-0003) from what was typed: `70000`, `70.000` (dot
 * thousands, as Rupiah are written), shorthand like `70rb`, `70k` or `1,5jt`,
 * or a leading minus for a refund. Anything that would leave a fraction of a
 * Rupiah is refused rather than rounded.
 */
export const parseAmount = (text: string): { amount: number } | { error: string } => {
  const typed = text.trim().replace(/^−/, "-").replace(/\s+/g, "").toLowerCase()
  if (typed === "") return { error: "Enter an amount" }
  const short = /^(-?\d+(?:[.,]\d+)?)(rb|k|jt)$/.exec(typed)
  if (short !== null) {
    const [, number = "", unit = ""] = short
    const amount =
      Math.round(Number(number.replace(",", ".")) * (thousands[unit] ?? 1) * 1000) / 1000
    return Number.isSafeInteger(amount) ? { amount } : { error: wholeRupiah }
  }
  const digits = /^-?\d{1,3}(\.\d{3})+$/.test(typed) ? typed.replaceAll(".", "") : typed
  if (!/^-?\d+$/.test(digits)) return { error: wholeRupiah }
  const amount = Number(digits)
  return Number.isSafeInteger(amount) ? { amount } : { error: wholeRupiah }
}
