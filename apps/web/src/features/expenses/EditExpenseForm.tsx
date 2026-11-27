import { type Expense, ExpenseNotFound } from "@expense/contract"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ExpenseForm, valuesOf } from "./ExpenseFormView.tsx"
import { useEditExpense } from "./useEditExpense.ts"
import { expensesKey } from "../../shared/api/queryKeys.ts"

/**
 * Edits amount, Category, merchant, note and date of a Draft or confirmed
 * Expense in place. If it turns out to be gone, closing the form refreshes
 * the lists so its row goes too.
 */
export const EditExpenseForm = ({
  expense,
  onClose,
}: {
  expense: Expense
  onClose: () => void
}) => {
  const editExpense = useEditExpense(expense.id)
  const queryClient = useQueryClient()
  const [gone, setGone] = useState(false)

  return (
    <ExpenseForm
      name="Edit expense"
      initial={() => valuesOf(expense)}
      submitLabel="Save"
      pendingLabel="Saving…"
      cancelLabel={gone ? "Close" : "Cancel"}
      autoFocus
      className="my-2"
      save={(payload) => editExpense.mutateAsync(payload)}
      onSaveError={(error) => setGone(error instanceof ExpenseNotFound)}
      onDone={onClose}
      onCancel={() => {
        if (gone) void queryClient.invalidateQueries({ queryKey: expensesKey })
        onClose()
      }}
    />
  )
}
