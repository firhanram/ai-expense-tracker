import type { IsoDate } from "@expense/contract"

// An IsoDate is a calendar day, not an instant: format it in UTC so no time zone moves it.
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

const toUtc = (date: IsoDate) => new Date(`${date}T00:00:00Z`)

/** `24 Nov`, as the Expense list's date gutter shows it. */
export const formatDayMonth = (date: IsoDate): string => dayMonth.format(toUtc(date))

/** `24 Nov 2026`, as cards and the row sheet show it. */
export const formatDayMonthYear = (date: IsoDate): string => dayMonthYear.format(toUtc(date))
