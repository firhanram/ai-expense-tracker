import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"
import { Tabs, TabsPanel } from "@ui-sdk/react/tabs"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
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
import { useCategoryTotals } from "./useCategoryTotals.ts"
import { useExpenseActions } from "./useExpenseActions.ts"
import { useExpenses } from "./useExpenses.ts"
import { isListView, type ListView, ViewTabs } from "./ViewTabs.tsx"

const SkeletonRow = () => (
  <li className="flex h-14 items-center gap-3 border-b border-line">
    <span className="h-3 w-12 rounded-sm bg-surface-2" />
    <span className="ml-6 h-3 w-32 rounded-sm bg-surface-2" />
    <span className="ml-auto h-3 w-20 rounded-sm bg-surface-2 md:mr-11" />
  </li>
)

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** `N` opens Add expense, unless focus is somewhere that takes typing. */
const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** The Expense list at `/expenses`: one month of confirmed Expenses (or, on request, Drafts), newest date first. */
export const ExpenseListPage = () => {
  const [month, setMonth] = useState(() => monthOf(localToday()))
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null)
  const [view, setView] = useState<ListView>("confirmed")
  const range = monthRange(month)
  const filtered = categoryId === null ? range : { ...range, categoryId }
  const drafts = useExpenses({ ...filtered, status: "draft" })
  const confirmed = useExpenses(filtered)
  const expenses = view === "draft" ? drafts : confirmed
  const categoryTotals = useCategoryTotals(range)
  const actions = useExpenseActions()
  const [adding, setAdding] = useState(false)
  const total = confirmed.data?.reduce((sum, expense) => sum + expense.amount, 0) ?? 0

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      event.preventDefault()
      setAdding(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const list = expenses.isPending ? (
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
  )

  return (
    <Collapsible
      open={adding}
      onOpenChange={setAdding}
      className="flex flex-col pt-4 pb-12 md:pt-8"
    >
      <h1 className="sr-only">Expenses</h1>
      <Tabs
        value={view}
        onValueChange={(next) => {
          if (isListView(next)) setView(next)
        }}
      >
        <header className="flex flex-col">
          <div className="flex items-center justify-between gap-4">
            <MonthStepper month={month} onMonthChange={setMonth} />
            <CollapsibleTrigger
              title="Add expense (N)"
              aria-keyshortcuts="N"
              className="flex size-9 items-center justify-center gap-1.5 rounded-sm bg-accent text-sm font-semibold text-accent-fg transition-opacity duration-(--motion-color) hover:opacity-90 data-open:opacity-80 md:h-8 md:w-auto md:pr-3 md:pl-2.5"
            >
              <Plus aria-hidden="true" size={16} className="max-md:size-[18px]" />
              <span className="max-md:sr-only">Add expense</span>
            </CollapsibleTrigger>
          </div>
          {view === "draft" ? (
            <p className="pt-1.5 pb-2 pl-[22px] text-sm text-text-muted">
              {drafts.isSuccess ? plural(drafts.data.length, "draft", "drafts") : "—"}
            </p>
          ) : (
            <p className="flex items-baseline gap-2.5 pt-1.5 pb-2 pl-[22px]">
              <span className="font-num text-[24px] leading-8 font-semibold tabular md:text-2xl">
                <span className="sr-only">Month total: </span>
                {confirmed.isSuccess ? formatRupiah(total) : "—"}
              </span>
              {confirmed.isSuccess ? (
                <span className="text-sm text-text-muted">
                  <span className="max-md:hidden">spent · </span>
                  {plural(confirmed.data.length, "expense", "expenses")}
                </span>
              ) : null}
            </p>
          )}
          <div className="flex items-center justify-between gap-4 border-b border-line">
            <ViewTabs draftCount={drafts.data?.length} />
            <CategoryFilter
              value={categoryId}
              onValueChange={setCategoryId}
              report={categoryTotals.data}
            />
          </div>
        </header>
        <CollapsiblePanel>
          <AddExpenseForm onDone={() => setAdding(false)} />
        </CollapsiblePanel>
        {actions.errorMessage === null ? null : (
          <p role="alert" className="border-b border-line py-3 text-sm text-danger">
            {actions.errorMessage}
          </p>
        )}
        <TabsPanel value="confirmed">{view === "confirmed" ? list : null}</TabsPanel>
        <TabsPanel value="draft">{view === "draft" ? list : null}</TabsPanel>
      </Tabs>
    </Collapsible>
  )
}
