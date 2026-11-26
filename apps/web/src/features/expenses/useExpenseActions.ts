import {
  type Expense,
  ExpenseConfirmed,
  ExpenseDiscarded,
  ExpenseNotFound,
  Unauthorized,
} from "@expense/contract"
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../shared/api/api.ts"
import { formatDayMonth } from "../../shared/format/shortDate.ts"
import { type ExpenseAction, isExpense, isListQuery, placeExpense } from "./expenseLists.ts"
import { expensesKey } from "./useExpenses.ts"

/** How a message or a button names an Expense: the merchant, else the note, else its date. */
export const expenseLabel = (expense: Expense) =>
  expense.merchant ?? expense.note ?? `expense on ${formatDayMonth(expense.occurredAt)}`

/** One line for a failed confirm or discard, naming the Expense. */
export const actionErrorMessage = (action: ExpenseAction, expense: Expense, error: unknown) => {
  const label = expenseLabel(expense)
  if (error instanceof ExpenseDiscarded) return `${label} was discarded and can't be confirmed.`
  if (error instanceof ExpenseConfirmed) return `${label} is already confirmed. Delete it instead.`
  if (error instanceof ExpenseNotFound) return `${label} no longer exists.`
  if (error instanceof Unauthorized) return "Not authorised. Check the API token."
  return `Couldn't ${action} ${label}. Try again.`
}

const writeIntoLists = (queryClient: QueryClient, expense: Expense) => {
  for (const [key, list] of queryClient.getQueriesData<ReadonlyArray<Expense>>({
    queryKey: expensesKey,
  })) {
    const query = key[1]
    if (list !== undefined && isListQuery(query))
      queryClient.setQueryData(key, placeExpense(list, query, expense))
  }
}

const useAction = (action: ExpenseAction) => {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationKey: [...expensesKey, action],
    mutationFn: (expense: Expense) =>
      action === "confirm"
        ? api((client) => client.expenses.confirm({ params: { id: expense.id } }))
        : api((client) => client.expenses.discard({ params: { id: expense.id } })),
    // A list fetch already on its way may predate this action; the pending
    // mutation is layered over lists by useExpenses until it settles.
    onMutate: () => queryClient.cancelQueries({ queryKey: expensesKey }),
    onSuccess: (saved) => writeIntoLists(queryClient, saved),
    onSettled: () => queryClient.invalidateQueries({ queryKey: expensesKey }),
  })
  const run = (expense: Expense) => {
    const inFlight = queryClient.isMutating({
      mutationKey: expensesKey,
      predicate: (other) =>
        isExpense(other.state.variables) && other.state.variables.id === expense.id,
    })
    if (inFlight === 0) mutation.mutate(expense)
  }
  return [run, mutation] as const
}

/**
 * Confirm and discard for Drafts, wherever they are shown (the list, the chat's
 * Draft card). Each moves the row at once — out of Drafts, into Confirmed —
 * and reconciles with the server; a failure puts it back. A press while an
 * action on the same Expense is in flight is ignored, so a double press sends
 * one request (and the endpoints are idempotent anyway, ADR-0007).
 *
 * `confirmation` and `discarding` are this caller's own mutation states, for
 * "Confirming…", the confirmed/discarded result and the error.
 */
export const useExpenseActions = () => {
  const [confirm, confirmation] = useAction("confirm")
  const [discard, discarding] = useAction("discard")
  const latest =
    confirmation.submittedAt >= discarding.submittedAt
      ? { action: "confirm" as const, mutation: confirmation }
      : { action: "discard" as const, mutation: discarding }
  const { error, variables } = latest.mutation
  return {
    confirm,
    discard,
    confirmation,
    discarding,
    /** What went wrong with this caller's most recent action, as one line, or null. */
    errorMessage:
      error === null || variables === undefined
        ? null
        : actionErrorMessage(latest.action, variables, error),
  }
}
