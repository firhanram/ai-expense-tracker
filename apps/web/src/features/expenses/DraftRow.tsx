import type { Expense } from "@expense/contract"
import { Button } from "@ui-sdk/react/button"
import { CircleDashed } from "lucide-react"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonth } from "../../shared/format/shortDate.ts"
import { expenseLabel } from "./useExpenseActions.ts"

/** The outlined status chip, as on the Expense card ("✓ Confirmed"), reading "Draft". */
export const DraftChip = () => (
  <span className="inline-flex shrink-0 items-center gap-1 justify-self-start rounded-sm border border-line px-2 py-px text-sm text-text-muted">
    <CircleDashed aria-hidden="true" size={12} />
    Draft
  </span>
)

const button =
  "h-7 rounded-sm px-3 text-sm font-medium transition-[background-color,opacity] duration-(--motion-color) data-disabled:opacity-70"

/**
 * A Draft in the list: the Expense row's columns plus a Draft chip and its
 * Confirm (the app's one primary button) and Discard. On mobile the chip and
 * the buttons take a second line under the merchant and amount.
 */
export const DraftRow = ({
  expense,
  disabled = false,
  onConfirm,
  onDiscard,
}: {
  expense: Expense
  disabled?: boolean
  onConfirm: () => void
  onDiscard: () => void
}) => {
  const label = expenseLabel(expense)
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-line py-3 transition-colors duration-(--motion-color) hover:bg-surface md:flex md:h-14 md:py-0">
      <span className="text-sm text-text-muted md:w-[72px] md:shrink-0">
        {formatDayMonth(expense.occurredAt)}
      </span>
      <span className="min-w-0 truncate text-md md:flex-1">
        {expense.merchant ?? expense.note ?? <span className="text-text-muted">—</span>}
      </span>
      <span className="hidden shrink-0 rounded-sm bg-surface-2 px-2 py-[3px] text-sm md:inline-block">
        {categoryName(expense.categoryId)}
      </span>
      <span className="col-start-2 row-start-2 md:contents">
        <DraftChip />
      </span>
      <span
        data-refund={expense.amount < 0}
        className="col-start-3 row-start-1 text-right font-num text-md tabular data-[refund=true]:text-danger md:w-[120px] md:shrink-0"
      >
        {formatRupiah(expense.amount)}
      </span>
      <span className="col-start-3 row-start-2 flex shrink-0 justify-end gap-2">
        <Button
          aria-label={`Confirm ${label}`}
          disabled={disabled}
          onClick={onConfirm}
          className={`${button} bg-accent text-accent-fg hover:opacity-90`}
        >
          Confirm
        </Button>
        <Button
          aria-label={`Discard ${label}`}
          disabled={disabled}
          onClick={onDiscard}
          className={`${button} border border-line bg-surface hover:bg-surface-2`}
        >
          Discard
        </Button>
      </span>
    </li>
  )
}
