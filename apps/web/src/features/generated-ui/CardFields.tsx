import type { EditExpense, Expense } from "@expense/contract"
import { Input } from "@ui-sdk/react/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Check, Pencil } from "lucide-react"
import { type KeyboardEvent, useState } from "react"
import { categories } from "../../shared/categories/categories.ts"
import { errorsFromApi } from "../expenses/expenseForm.ts"
import { useEditExpense } from "../expenses/useEditExpense.ts"

const categoryItems = categories.map((category) => ({
  value: String(category.id),
  label: category.name,
}))

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
    <Select
      items={categoryItems}
      value={String(expense.categoryId)}
      disabled={disabled || edit.isPending}
      onValueChange={(value) => {
        if (value !== null && Number(value) !== expense.categoryId)
          edit.mutate({ categoryId: Number(value) })
      }}
    >
      <SelectTrigger
        aria-label="Edit category"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-surface-2 px-2 py-[3px] text-sm transition-colors duration-(--motion-color) hover:bg-line data-open:bg-line"
      >
        <SelectValue />
        <Pencil aria-hidden="true" size={12} className="text-text-muted" />
      </SelectTrigger>
      <SelectContent className="max-h-(--available-height) w-48 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop">
        {categoryItems.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="flex cursor-default items-center justify-between rounded-sm px-2 py-1.5 text-sm data-highlighted:bg-surface-2"
          >
            {item.label}
            <SelectItemIndicator>
              <Check aria-hidden="true" size={14} />
            </SelectItemIndicator>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    edit.mutate(payload, { onSuccess: close, onError: (failure) => setError(editError(failure)) })
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
