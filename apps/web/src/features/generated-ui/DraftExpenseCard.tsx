import type { Expense, ExpenseId } from "@expense/contract"
import { useTriggerAction } from "@openuidev/react-lang"
import { Button } from "@ui-sdk/react/button"
import { Check, TriangleAlert } from "lucide-react"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonthYear } from "../../shared/format/shortDate.ts"
import { useExpenseActivity } from "../expenses/useExpenseActions.ts"
import { ReceiptPhoto } from "../receipts/ReceiptPhoto.tsx"
import { CardLine, CardSkeleton } from "./CardSkeleton.tsx"
import { CategoryEdit, InlineEdit } from "./CardFields.tsx"
import { edits } from "./expenseEdits.ts"
import { useExpense } from "./useExpense.ts"

type CardState = "draft" | "confirming" | "confirmed"

const button =
  "h-8 rounded-sm px-4 text-sm font-semibold transition-[background-color,opacity] duration-(--motion-color) data-disabled:opacity-70"

const CheckAmount = () => (
  <span className="inline-flex items-center gap-1 self-start rounded-sm bg-warn-bg px-1.5 py-px text-xs font-medium text-warn-fg">
    <TriangleAlert aria-hidden="true" size={12} />
    Check amount
  </span>
)

/** The fields every non-collapsed state shows; each one edits in place. */
const Fields = ({
  expense,
  disabled,
}: {
  readonly expense: Expense
  readonly disabled: boolean
}) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <InlineEdit
        expense={expense}
        label="amount"
        shown={formatRupiah(expense.amount)}
        initial={String(expense.amount)}
        toPayload={edits.amount}
        disabled={disabled}
        className={`shrink-0 font-num text-2xl tabular ${expense.amount < 0 ? "text-danger" : ""}`}
        inputClassName="w-44 font-num text-2xl tabular"
      />
      <CategoryEdit expense={expense} disabled={disabled} />
    </div>
    <p className="flex min-w-0 flex-wrap items-center text-sm text-text-muted">
      <InlineEdit
        expense={expense}
        label="merchant"
        shown={expense.merchant ?? "Add merchant"}
        initial={expense.merchant ?? ""}
        toPayload={edits.merchant}
        disabled={disabled}
        inputClassName="w-40 text-sm text-text"
      />
      <span aria-hidden="true" className="whitespace-pre">
        {" · "}
      </span>
      <InlineEdit
        expense={expense}
        label="date"
        type="date"
        shown={formatDayMonthYear(expense.occurredAt)}
        initial={expense.occurredAt}
        toPayload={edits.occurredAt}
        disabled={disabled}
        inputClassName="text-sm text-text"
      />
    </p>
    {expense.note === null ? null : (
      <p className="flex min-w-0 text-sm text-text-muted">
        <InlineEdit
          expense={expense}
          label="note"
          shown={expense.note}
          initial={expense.note}
          toPayload={edits.note}
          disabled={disabled}
          inputClassName="w-full text-sm text-text"
        />
      </p>
    )}
  </>
)

const Actions = ({
  expense,
  state,
  errorMessage,
}: {
  readonly expense: Expense
  readonly state: CardState
  readonly errorMessage: string | null
}) => {
  const triggerAction = useTriggerAction()
  const fire = (name: "ConfirmExpense" | "DiscardExpense", label: string) =>
    void triggerAction(label, undefined, {
      steps: [{ type: "custom_action", name, params: { id: expense.id } }],
    })

  if (state === "confirmed")
    return (
      <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
        Confirmed <Check aria-hidden="true" size={14} />
      </p>
    )
  const busy = state === "confirming"
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy}
          onClick={() => fire("ConfirmExpense", "Confirm")}
          className={`${button} bg-accent text-accent-fg hover:opacity-90`}
        >
          {busy ? "Confirming…" : "Confirm"}
        </Button>
        <Button
          disabled={busy}
          onClick={() => fire("DiscardExpense", "Discard")}
          className={`${button} border border-line bg-surface hover:bg-surface-2`}
        >
          Discard
        </Button>
        {expense.note === null && !busy ? (
          <InlineEdit
            expense={expense}
            label="note"
            shown="Add note"
            initial=""
            toPayload={edits.note}
            className="ml-auto text-sm text-text-muted transition-opacity duration-(--motion-color) pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
            inputClassName="w-48 text-sm"
          />
        ) : null}
      </div>
      {errorMessage === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

const DraftCardBody = ({ expense }: { readonly expense: Expense }) => {
  const activity = useExpenseActivity(expense.id)
  const state: CardState =
    activity.pending === "confirm"
      ? "confirming"
      : expense.status === "confirmed"
        ? "confirmed"
        : "draft"

  if (expense.status === "discarded")
    return (
      <p
        aria-label="Discarded Draft Expense"
        className="flex items-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-text-muted transition-opacity duration-(--motion-layout) starting:opacity-0"
      >
        {["Discarded", formatRupiah(expense.amount), expense.merchant]
          .filter((part) => part !== null)
          .join(" · ")}
      </p>
    )

  return (
    <article
      aria-label={`Draft Expense ${formatRupiah(expense.amount)}`}
      data-state={state}
      className="group flex gap-3 rounded-lg border border-line bg-surface p-4 transition-[background-color,opacity] duration-(--motion-layout) data-[state=confirmed]:bg-surface-2 data-[state=confirming]:opacity-70"
    >
      {expense.receiptKey === null ? null : <ReceiptPhoto receiptKey={expense.receiptKey} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {expense.needsReview && state !== "confirmed" ? <CheckAmount /> : null}
        <Fields expense={expense} disabled={state === "confirming"} />
        <Actions expense={expense} state={state} errorMessage={activity.errorMessage} />
      </div>
    </article>
  )
}

/**
 * A Draft Expense in the chat, fetched by id (ADR-0001), so it follows the
 * agent's later edits and discards. Confirm and Discard fire library actions
 * the app handles by calling the API, never the model (ADR-0007).
 */
export const DraftExpenseCard = ({ id }: { readonly id: ExpenseId }) => {
  const lookup = useExpense(id)
  switch (lookup.state) {
    case "loading":
      return <CardSkeleton label="Draft Expense" />
    case "found":
      return <DraftCardBody expense={lookup.expense} />
    case "not-found":
      return <CardLine>This draft no longer exists</CardLine>
    default:
      return <CardLine>Couldn't load this draft</CardLine>
  }
}
