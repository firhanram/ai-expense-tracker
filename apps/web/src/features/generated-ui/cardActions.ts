import type { Expense } from "@expense/contract"
import type { LibraryActionEvent } from "@openuidev/react-lang"
import { useQueryClient } from "@tanstack/react-query"
import { useExpenseActions } from "../expenses/useExpenseActions.ts"
import { expenseKey } from "../expenses/useExpenses.ts"
import type { webLibrary } from "./webLibrary.tsx"

/** What a generated component asked for: `ConfirmExpense` or `DiscardExpense` with `{ id }`, or a built-in. */
export type CardAction = LibraryActionEvent<typeof webLibrary>

/**
 * The Renderer's `onAction`. A card fires an action with `useTriggerAction`
 * and a `custom_action` step; handling it calls the API directly, never the
 * model (ADR-0007). The Expense comes from the card's own cache entry, which
 * is what the card shows, so the optimistic move starts from what was pressed.
 */
export const useCardActions = () => {
  const queryClient = useQueryClient()
  const { confirm, discard } = useExpenseActions()
  return (action: CardAction) => {
    if (action.type !== "ConfirmExpense" && action.type !== "DiscardExpense") return
    const expense = queryClient.getQueryData<Expense>(expenseKey(action.params.id))
    // Only a Draft moves: a press that lands after the first one settled finds it moved already.
    if (expense?.status !== "draft") return
    if (action.type === "ConfirmExpense") confirm(expense)
    else discard(expense)
  }
}
