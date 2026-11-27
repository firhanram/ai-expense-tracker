import type { EditExpense, Expense } from "@expense/contract"
import { Input } from "@ui-sdk/react/input"
import { Pencil } from "lucide-react"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonthYear } from "../../shared/format/shortDate.ts"
import { type KeyboardEvent, type ReactNode, useState } from "react"
import { CategorySelect } from "../../shared/categories/CategorySelect.tsx"
import { errorsFromApi, useEditExpense } from "../expenses/index.ts"
import { edits } from "./expenseEdits.ts"

/** What a refused edit says, as one line. */
const editError = (error: unknown) => Object.values(errorsFromApi(error))[0] ?? "Couldn't save."

/**
 * The Category chip with its ✎: the correction path for a wrong Category
 * (ADR-0004). Picking one is a `PATCH` on the Expense.
 */
export const CategoryEdit = ({
  expense,
  disabled = false,
}: {
  readonly expense: Expense
  readonly disabled?: boolean
}) => {
  const edit = useEditExpense(expense.id)
  return (
    <CategorySelect
      value={String(expense.categoryId)}
      disabled={disabled || edit.isPending}
      onValueChange={(value) => {
        if (value !== null && Number(value) !== expense.categoryId)
          edit.mutate({ categoryId: Number(value) })
      }}
      triggerLabel="Edit category"
      triggerClassName="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-surface-2 px-2 py-[3px] text-sm transition-colors duration-(--motion-color) hover:bg-line data-open:bg-line"
      icon={<Pencil aria-hidden="true" size={12} className="text-text-muted" />}
    />
  )
}

/**
 * One field of a card that turns into an input in place when tapped: Enter
 * or leaving it saves with a `PATCH`, Escape puts it back. `toPayload` turns
 * what was typed into the edit, or a message when it can't be saved.
 */
export const InlineEdit = ({
  expense,
  label,
  shown,
  initial,
  toPayload,
  type = "text",
  disabled = false,
  readOnly = false,
  className = "",
  inputClassName = "",
}: {
  readonly expense: Expense
  readonly label: string
  readonly shown: string
  readonly initial: string
  readonly toPayload: (typed: string) => EditExpense | string
  readonly type?: "text" | "date"
  readonly disabled?: boolean
  /** Shown as plain text, with nothing to tap: a discarded Expense. */
  readonly readOnly?: boolean
  readonly className?: string
  readonly inputClassName?: string
}) => {
  const edit = useEditExpense(expense.id)
  const [typed, setTyped] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setTyped(null)
    setError(null)
  }
  const save = () => {
    if (typed === null || edit.isPending) return
    if (typed === initial) return close()
    const payload = toPayload(typed)
    if (typeof payload === "string") return setError(payload)
    edit.mutate(payload, {
      onSuccess: close,
      onError: (failure) => setError(editError(failure)),
    })
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      save()
    } else if (event.key === "Escape") {
      event.preventDefault()
      close()
    }
  }

  if (readOnly) return <span className={`min-w-0 truncate ${className}`}>{shown}</span>
  if (typed === null)
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        disabled={disabled}
        onClick={() => setTyped(initial)}
        className={`min-w-0 cursor-text truncate rounded-sm text-left hover:underline hover:decoration-line hover:underline-offset-4 disabled:cursor-default disabled:no-underline ${className}`}
      >
        {shown}
      </button>
    )
  return (
    <span className="inline-flex min-w-0 flex-col gap-1">
      <Input
        aria-label={label}
        aria-invalid={error !== null}
        autoFocus
        autoComplete="off"
        type={type}
        value={typed}
        disabled={edit.isPending}
        onValueChange={(value) => {
          setTyped(value)
          setError(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={save}
        className={`min-w-0 rounded-sm border border-ring bg-surface px-1.5 ${inputClassName}`}
      />
      {error === null ? null : (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  )
}

/**
 * An Expense card's fields, shared by the Draft and Expense cards (DESIGN,
 * "Expense card": the same inline fields): the amount with `chips` beside
 * it, merchant · date, and the note. With no merchant, the note takes the
 * merchant's place, as it does in the Expense list. Each edits in place
 * unless `readOnly`.
 */
export const ExpenseFields = ({
  expense,
  chips,
  disabled = false,
  readOnly = false,
}: {
  readonly expense: Expense
  readonly chips: ReactNode
  readonly disabled?: boolean
  readonly readOnly?: boolean
}) => {
  const noteAsTitle = expense.merchant === null && expense.note !== null
  const note = (
    <InlineEdit
      expense={expense}
      label="note"
      shown={expense.note ?? ""}
      initial={expense.note ?? ""}
      toPayload={edits.note}
      disabled={disabled}
      readOnly={readOnly}
      inputClassName={noteAsTitle ? "w-40 text-sm text-text" : "w-full text-sm text-text"}
    />
  )
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <InlineEdit
          expense={expense}
          label="amount"
          shown={formatRupiah(expense.amount)}
          initial={String(expense.amount)}
          toPayload={edits.amount}
          disabled={disabled}
          readOnly={readOnly}
          className={`shrink-0 font-num text-2xl tabular ${expense.amount < 0 ? "text-danger" : ""}`}
          inputClassName="w-44 font-num text-2xl tabular"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">{chips}</div>
      </div>
      <p className="flex min-w-0 flex-wrap items-center text-sm text-text-muted">
        {noteAsTitle ? (
          note
        ) : (
          <InlineEdit
            expense={expense}
            label="merchant"
            shown={expense.merchant ?? "Add merchant"}
            initial={expense.merchant ?? ""}
            toPayload={edits.merchant}
            disabled={disabled}
            readOnly={readOnly}
            inputClassName="w-40 text-sm text-text"
          />
        )}
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
          readOnly={readOnly}
          inputClassName="text-sm text-text"
        />
      </p>
      {expense.note === null || noteAsTitle ? null : (
        <p className="flex min-w-0 text-sm text-text-muted">{note}</p>
      )}
    </>
  )
}
