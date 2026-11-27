import type { Expense } from "@expense/contract"
import { type Ref, useEffect, useRef, useState } from "react"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonth } from "../../shared/format/shortDate.ts"
import { ReceiptMarker } from "../receipts/index.ts"
import { EditExpenseForm } from "./EditExpenseForm.tsx"
import { ExpenseRowMenu } from "./ExpenseRowMenu.tsx"
import { useDeleteExpense } from "./useDeleteExpense.ts"

type Mode = "idle" | "editing" | "confirming"

const DeleteConfirm = ({
  expense,
  name,
  noRef,
  onNo,
}: {
  expense: Expense
  name: string
  noRef: Ref<HTMLButtonElement>
  onNo: () => void
}) => {
  const remove = useDeleteExpense(expense.id)
  return (
    <span
      data-slot="row-actions"
      className="relative z-10 flex shrink-0 items-center gap-3 text-sm"
    >
      {remove.isError ? (
        <span role="alert" className="text-danger">
          Couldn't delete.
        </span>
      ) : null}
      <span className="text-text-muted">Delete?</span>
      <button
        type="button"
        aria-label={`Yes, delete ${name}`}
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
        className="rounded-sm font-semibold text-danger disabled:opacity-70"
      >
        Yes
      </button>
      <button
        ref={noRef}
        type="button"
        disabled={remove.isPending}
        onClick={onNo}
        className="rounded-sm font-semibold disabled:opacity-70"
      >
        No
      </button>
    </span>
  )
}

/**
 * One 56px row: date gutter, merchant, Category chip (desktop only) and the
 * amount in a fixed 120px column so amounts align down the page. The last
 * column holds the row's actions, or the inline delete confirmation; editing
 * swaps the row for the Expense form.
 */
export const ExpenseRow = ({ expense }: { expense: Expense }) => {
  const [mode, setMode] = useState<Mode>("idle")
  const trigger = useRef<HTMLButtonElement>(null)
  const no = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const name = expense.merchant ?? expense.note ?? "Expense"
  const label = `${name}, ${formatDayMonth(expense.occurredAt)}`

  useEffect(() => {
    if (mode === "confirming") no.current?.focus()
    if (mode === "idle" && returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus()
    }
  }, [mode])

  const backToIdle = () => {
    returnFocus.current = true
    setMode("idle")
  }

  if (mode === "editing")
    return (
      <li className="border-b border-line">
        <EditExpenseForm expense={expense} onClose={backToIdle} />
      </li>
    )

  return (
    <li
      className="group relative flex h-14 items-center gap-3 border-b border-line transition-colors duration-(--motion-color) hover:bg-surface has-data-open:bg-surface data-[mode=confirming]:bg-surface"
      data-mode={mode}
    >
      <span className="w-[72px] shrink-0 text-sm text-text-muted">
        {formatDayMonth(expense.occurredAt)}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-md">
        <span className="truncate">
          {expense.merchant ?? expense.note ?? <span className="text-text-muted">—</span>}
        </span>
        {expense.receiptKey === null ? null : <ReceiptMarker />}
      </span>
      <span className="hidden shrink-0 rounded-sm bg-surface-2 px-2 py-[3px] text-sm md:inline-block">
        {categoryName(expense.categoryId)}
      </span>
      <span
        data-refund={expense.amount < 0}
        className="w-[120px] shrink-0 text-right font-num text-md tabular group-data-[mode=confirming]:max-md:w-auto data-[refund=true]:text-danger"
      >
        {formatRupiah(expense.amount)}
      </span>
      {mode === "confirming" ? (
        <DeleteConfirm expense={expense} name={name} noRef={no} onNo={backToIdle} />
      ) : (
        <span data-slot="row-actions" className="w-0 shrink-0 max-md:-ml-3 md:w-8">
          <ExpenseRowMenu
            expense={expense}
            label={label}
            triggerRef={trigger}
            onAction={(action) => setMode(action === "edit" ? "editing" : "confirming")}
          />
        </span>
      )}
    </li>
  )
}
