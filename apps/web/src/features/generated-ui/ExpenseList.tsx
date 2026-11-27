import type { ListExpensesQuery } from "@expense/contract"
import { ExpenseRow, useExpenses } from "../expenses/index.ts"
import { CardLine, CardSkeleton } from "../../shared/ui/CardSkeleton.tsx"

/** Expenses the app fetches for a status, range and Category, as rows of the Expenses page. */
export const ExpenseList = ({ query }: { readonly query: ListExpensesQuery }) => {
  const expenses = useExpenses(query)
  if (expenses.isPending) return <CardSkeleton label="Expenses" />
  if (expenses.isError) return <CardLine>Couldn't load these expenses</CardLine>
  if (expenses.data.length === 0) return <CardLine>No expenses in this range</CardLine>
  return (
    <section
      aria-label="Expenses"
      className="rounded-lg border border-line bg-surface px-4 [&_li:last-child]:border-b-0"
    >
      <ul>
        {expenses.data.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} />
        ))}
      </ul>
    </section>
  )
}
