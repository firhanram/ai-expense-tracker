import type { Expense, ExpenseId, ExpenseStatus } from "@expense/contract"
import { Check } from "lucide-react"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonthYear } from "../../shared/format/shortDate.ts"
import { CategoryEdit } from "./CardFields.tsx"
import { CardLine, CardSkeleton } from "../../shared/ui/CardSkeleton.tsx"
import { useExpense } from "./useExpense.ts"

const statusLabel: Readonly<Record<ExpenseStatus, string>> = {
  draft: "Draft",
  confirmed: "Confirmed",
  discarded: "Discarded",
}

const StatusChip = ({ status }: { readonly status: ExpenseStatus }) => (
  <span className="inline-flex items-center gap-1 rounded-sm border border-line px-2 py-[3px] text-sm text-text-muted">
    {status === "confirmed" ? <Check aria-hidden="true" size={12} /> : null}
    {statusLabel[status]}
  </span>
)

const details = (expense: Expense) =>
  [expense.merchant, formatDayMonthYear(expense.occurredAt), expense.note]
    .filter((part) => part !== null && part !== "")
    .join(" · ")

const ExpenseCardBody = ({ expense }: { readonly expense: Expense }) => (
  <article
    aria-label={`Expense ${formatRupiah(expense.amount)}`}
    className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 md:flex-row md:items-start md:gap-3"
  >
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p
        data-refund={expense.amount < 0}
        className="font-num text-2xl tabular data-[refund=true]:text-danger"
      >
        {formatRupiah(expense.amount)}
      </p>
      <p className="truncate text-sm text-text-muted">{details(expense)}</p>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
      {expense.status === "discarded" ? (
        <span className="rounded-sm bg-surface-2 px-2 py-[3px] text-sm">
          {categoryName(expense.categoryId)}
        </span>
      ) : (
        <CategoryEdit expense={expense} />
      )}
      <StatusChip status={expense.status} />
    </div>
  </article>
)

/** One recorded Expense, fetched by id (ADR-0001): Draft card geometry, minus the thumbnail. */
export const ExpenseCard = ({ id }: { readonly id: ExpenseId }) => {
  const lookup = useExpense(id)
  switch (lookup.state) {
    case "loading":
      return <CardSkeleton label="Expense" />
    case "found":
      return <ExpenseCardBody expense={lookup.expense} />
    case "not-found":
      return <CardLine>This expense no longer exists</CardLine>
    default:
      return <CardLine>Couldn't load this expense</CardLine>
  }
}
