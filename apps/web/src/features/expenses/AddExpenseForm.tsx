import { localToday } from "../../shared/format/localDate.ts"
import { ExpenseForm } from "./ExpenseFormView.tsx"
import { useCreateExpense } from "./useCreateExpense.ts"

/** The manual way to record an Expense (no agent): it is confirmed on creation. */
export const AddExpenseForm = ({ onDone }: { onDone: () => void }) => {
  const create = useCreateExpense()
  return (
    <ExpenseForm
      name="Add expense"
      initial={() => ({
        amount: "",
        categoryId: null,
        merchant: "",
        note: "",
        occurredAt: localToday(),
      })}
      submitLabel="Add expense"
      pendingLabel="Adding…"
      className="mt-4 mb-2"
      save={(payload) => create.mutateAsync(payload)}
      onDone={onDone}
      onCancel={onDone}
    />
  )
}
