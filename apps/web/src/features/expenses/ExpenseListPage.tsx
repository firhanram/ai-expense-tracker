import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"
import { Plus } from "lucide-react"
import { useState } from "react"
import type { CategoryId } from "@expense/contract"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { localToday } from "../../shared/format/localDate.ts"
import { AddExpenseForm } from "./AddExpenseForm.tsx"
import { CategoryFilter } from "./CategoryFilter.tsx"
import { DraftRow } from "./DraftRow.tsx"
import { ExpenseRow } from "./ExpenseRow.tsx"
import { formatMonth, monthOf, monthRange } from "../../shared/format/month.ts"
import { MonthStepper } from "./MonthStepper.tsx"
import { type ListView, StatusSwitch } from "./StatusSwitch.tsx"
import { useCategoryTotals } from "./useCategoryTotals.ts"
import { useExpenseActions } from "./useExpenseActions.ts"
import { useExpenses } from "./useExpenses.ts"

const SkeletonRow = () => (
  <li className="flex h-14 items-center gap-3 border-b border-line">
    <span className="h-3 w-12 rounded-sm bg-surface-2" />
    <span className="ml-6 h-3 w-32 rounded-sm bg-surface-2" />
    <span className="ml-auto h-3 w-20 rounded-sm bg-surface-2 md:mr-11" />
  </li>
)

/** The Expense list at `/expenses`: one month of confirmed Expenses (or, on request, Drafts), newest date first. */
export const ExpenseListPage = () => {
  const [month, setMonth] = useState(() => monthOf(localToday()))
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null)
  const [view, setView] = useState<ListView>("confirmed")
  const range = monthRange(month)
  const filtered = categoryId === null ? range : { ...range, categoryId }
  const expenses = useExpenses(view === "draft" ? { ...filtered, status: "draft" } : filtered)
  const categoryTotals = useCategoryTotals(range)
  const actions = useExpenseActions()
  const [adding, setAdding] = useState(false)
  const total = expenses.data?.reduce((sum, expense) => sum + expense.amount, 0) ?? 0

  return (
    <Collapsible
      open={adding}
      onOpenChange={setAdding}
      className="flex flex-col pt-4 pb-12 md:pt-8"
    >
      <h1 className="sr-only">Expenses</h1>
      <header className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line pb-4 [grid-template-areas:'title_total'_'controls_controls'] md:pb-3.5 md:[grid-template-areas:'title_controls'_'title_total']">
        <MonthStepper month={month} onMonthChange={setMonth} className="[grid-area:title]" />
        <div className="flex flex-wrap items-center gap-2 [grid-area:controls] md:justify-end">
          <div className="order-last basis-full md:order-none md:basis-auto">
            <StatusSwitch value={view} onChange={setView} />
          </div>
          <CategoryFilter
            value={categoryId}
            onValueChange={setCategoryId}
            report={categoryTotals.data}
          />
          <CollapsibleTrigger className="flex h-7 items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 text-sm transition-colors duration-(--motion-color) hover:bg-surface-2 data-open:border-ring data-open:bg-surface-2">
            <Plus aria-hidden="true" size={14} />
            Add expense
          </CollapsibleTrigger>
        </div>
        {view === "draft" ? (
          <p className="text-right text-sm text-text-muted [grid-area:total]">
            {expenses.isSuccess
              ? `${expenses.data.length} ${expenses.data.length === 1 ? "draft" : "drafts"}`
              : "—"}
          </p>
        ) : (
          <p className="text-right font-num text-lg tabular [grid-area:total]">
            <span className="sr-only">Month total: </span>
            <span>{expenses.isSuccess ? formatRupiah(total) : "—"}</span>
          </p>
        )}
      </header>
      <CollapsiblePanel>
        <AddExpenseForm onDone={() => setAdding(false)} />
      </CollapsiblePanel>
      {actions.errorMessage === null ? null : (
        <p role="alert" className="border-b border-line py-3 text-sm text-danger">
          {actions.errorMessage}
        </p>
      )}

      {expenses.isPending ? (
        <ul aria-label="Expenses" aria-busy="true">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      ) : expenses.isError ? (
        <p role="alert" className="py-4 text-sm text-danger">
          Couldn't load expenses.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => void expenses.refetch()}
          >
            Retry
          </button>
        </p>
      ) : expenses.data.length === 0 ? (
        <p className="py-12 text-center text-text-muted">
          {categoryId === null ? "No" : `No ${categoryName(categoryId)}`}{" "}
          {view === "draft" ? "drafts" : "expenses"} in {formatMonth(month)}
        </p>
      ) : (
        <ul aria-label="Expenses">
          {expenses.data.map((expense) =>
            expense.status === "draft" ? (
              <DraftRow
                key={expense.id}
                expense={expense}
                onConfirm={() => actions.confirm(expense)}
                onDiscard={() => actions.discard(expense)}
              />
            ) : (
              <ExpenseRow key={expense.id} expense={expense} />
            ),
          )}
        </ul>
      )}
    </Collapsible>
  )
}
