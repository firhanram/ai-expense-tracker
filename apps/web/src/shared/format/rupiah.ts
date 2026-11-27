import type { Rupiah } from "@expense/contract"

const digits = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 })

// The id-ID currency style puts a space after "Rp"; DESIGN.md wants `Rp15.000`.
export const formatRupiah = (amount: Rupiah): string =>
  `${amount < 0 ? "−" : ""}Rp${digits.format(Math.abs(amount))}`

/** `15.000` without the `Rp`, for a column of figures whose heading already says Rupiah. */
export const formatRupiahDigits = (amount: Rupiah): string =>
  `${amount < 0 ? "−" : ""}${digits.format(Math.abs(amount))}`
