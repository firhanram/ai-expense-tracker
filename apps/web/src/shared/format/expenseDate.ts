import type { IsoDate } from "@expense/contract"
import { toLocalIsoDate } from "./localDate.ts"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

const parse = (date: IsoDate) => {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number)
  return new Date(year, month - 1, day)
}

/** `date` moved by `days`, on the calendar rather than by 24-hour steps. */
export const addDays = (date: IsoDate, days: number): IsoDate => {
  const moved = parse(date)
  moved.setDate(moved.getDate() + days)
  return toLocalIsoDate(moved)
}

/** "Wed, 25 Nov". */
export const shortDate = (date: IsoDate): string => {
  const parsed = parse(date)
  return `${weekdays[parsed.getDay()]}, ${parsed.getDate()} ${months[parsed.getMonth()]}`
}

/** The Date chip's quick picks, newest first. */
export const quickPicks = (today: IsoDate) =>
  [
    { label: "Today", date: today },
    { label: "Yesterday", date: addDays(today, -1) },
    { label: "2 days ago", date: addDays(today, -2) },
  ] as const

/** What the Date chip says: a quick pick's name, else the short date. */
export const expenseDateLabel = (date: IsoDate, today: IsoDate): string =>
  quickPicks(today).find((pick) => pick.date === date)?.label ?? shortDate(date)
