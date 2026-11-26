import type { IsoDate } from "@expense/contract"
import { formatMonth, formatMonthShort, monthOf, monthRange } from "../expenses/month.ts"

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" })
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const utc = (date: IsoDate) => new Date(`${date}T00:00:00Z`)
const isMonthStart = (date: IsoDate) => monthRange(monthOf(date)).from === date
const isMonthEnd = (date: IsoDate) => monthRange(monthOf(date)).to === date

/**
 * A Report's range in words, as the chart's title says it: whole months by
 * name (`November 2026`, `January – June 2026`, `2026`), anything else by day
 * (`1–15 Nov 2026`, `20 Oct – 15 Nov 2026`).
 */
export const rangeTitle = ({ from, to }: { readonly from: IsoDate; readonly to: IsoDate }) => {
  const start = monthOf(from)
  const end = monthOf(to)
  const sameYear = start.year === end.year

  if (isMonthStart(from) && isMonthEnd(to)) {
    if (sameYear && start.month === end.month) return formatMonth(start)
    if (sameYear && start.month === 1 && end.month === 12) return String(start.year)
    if (sameYear) return `${monthName.format(utc(from))} – ${formatMonth(end)}`
    return `${formatMonth(start)} – ${formatMonth(end)}`
  }

  if (from === to) return dayMonthYear.format(utc(from))
  if (sameYear && start.month === end.month)
    return `${utc(from).getUTCDate()}–${dayMonthYear.format(utc(to))}`
  if (sameYear) return `${dayMonth.format(utc(from))} – ${dayMonthYear.format(utc(to))}`
  return `${dayMonthYear.format(utc(from))} – ${dayMonthYear.format(utc(to))}`
}

/** A month figure's `YYYY-MM` label as `Nov 2026`. */
export const monthLabel = (label: string): string => formatMonthShort(monthOf(`${label}-01`))
