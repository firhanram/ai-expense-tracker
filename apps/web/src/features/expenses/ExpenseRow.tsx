import type { Expense } from "@expense/contract"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonth } from "../../shared/format/shortDate.ts"

/**
 * One 56px row: date gutter, merchant, Category chip (desktop only) and the
 * amount in a fixed 120px column so amounts align down the page. The last
 * column is the slot for the row's actions.
 */
export const ExpenseRow = ({ expense }: { expense: Expense }) => (
  <li className="flex h-14 items-center gap-3 border-b border-line transition-colors duration-(--motion-color) hover:bg-surface">
    <span className="w-[72px] shrink-0 text-sm text-text-muted">
      {formatDayMonth(expense.occurredAt)}
    </span>
    <span className="min-w-0 flex-1 truncate text-md">
      {expense.merchant ?? expense.note ?? <span className="text-text-muted">—</span>}
    </span>
    <span className="hidden shrink-0 rounded-sm bg-surface-2 px-2 py-[3px] text-sm md:inline-block">
      {categoryName(expense.categoryId)}
    </span>
    <span
      data-refund={expense.amount < 0}
      className="w-[120px] shrink-0 text-right font-num text-md tabular data-[refund=true]:text-danger"
    >
      {formatRupiah(expense.amount)}
    </span>
    <span data-slot="row-actions" className="hidden w-8 shrink-0 md:block" />
  </li>
)
