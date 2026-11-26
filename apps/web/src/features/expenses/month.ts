import type { IsoDate } from "@expense/contract"

/** A calendar month: `month` is 1–12. */
export interface Month {
  readonly year: number
  readonly month: number
}

const pad = (n: number) => String(n).padStart(2, "0")

/** The month a `YYYY-MM-DD` date falls in. */
export const monthOf = (date: IsoDate): Month => ({
  year: Number(date.slice(0, 4)),
  month: Number(date.slice(5, 7)),
})

/** The month's first and last day, as `GET /expenses` takes them (ADR-0009: the client computes them). */
export const monthRange = ({ year, month }: Month): { from: IsoDate; to: IsoDate } => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` }
}

const long = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
const short = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })

const firstDay = ({ year, month }: Month) => new Date(Date.UTC(year, month - 1, 1))

/** `November 2026`. */
export const formatMonth = (m: Month): string => long.format(firstDay(m))

/** `Nov 2026`, for the mobile header. */
export const formatMonthShort = (m: Month): string => short.format(firstDay(m))
