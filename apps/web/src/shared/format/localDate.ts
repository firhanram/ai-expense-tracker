import type { IsoDate } from "@expense/contract"

const pad = (n: number) => String(n).padStart(2, "0")

/** `YYYY-MM-DD` on the user's clock. The server never decides "today" (ADR-0009). */
export const toLocalIsoDate = (date: Date): IsoDate =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const localToday = (): IsoDate => toLocalIsoDate(new Date())
