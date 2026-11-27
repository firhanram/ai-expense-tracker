import { Receipt } from "lucide-react"

/** Marks a list row whose Expense has a Receipt; screen readers hear "Has receipt". */
export const ReceiptMarker = () => (
  <span role="img" aria-label="Has receipt" className="shrink-0 text-text-muted">
    <Receipt aria-hidden="true" size={14} />
  </span>
)
