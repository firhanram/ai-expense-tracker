import type { Expense, ExpenseId, ExpenseStatus } from "@expense/contract"
import { Check } from "lucide-react"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { CardLine, CardSkeleton } from "../../shared/ui/CardSkeleton.tsx"
import { CategoryEdit, ExpenseFields } from "./CardFields.tsx"
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

/**
 * Draft card geometry, minus the thumbnail: the same inline fields, with the
 * Category chip followed by a status chip. A discarded Expense is shown, not edited.
 */
const ExpenseCardBody = ({ expense }: { readonly expense: Expense }) => {
  const discarded = expense.status === "discarded"
  return (
    <article
      aria-label={`Expense ${formatRupiah(expense.amount)}`}
      className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4"
    >
      <ExpenseFields
        expense={expense}
        readOnly={discarded}
        chips={
          <>
            {discarded ? (
              <span className="rounded-sm bg-surface-2 px-2 py-[3px] text-sm">
                {categoryName(expense.categoryId)}
              </span>
            ) : (
              <CategoryEdit expense={expense} />
            )}
            <StatusChip status={expense.status} />
          </>
        }
      />
    </article>
  )
}

/** One recorded Expense, fetched by id (ADR-0001). */
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
