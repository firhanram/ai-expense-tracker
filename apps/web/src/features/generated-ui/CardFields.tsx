import type { EditExpense, Expense } from "@expense/contract"
import { DatePicker, DatePickerTrigger } from "@ui-sdk/react/date-picker"
import { Input } from "@ui-sdk/react/input"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover"
import { Calendar, Check, Plus, StickyNote, Store, Tag } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { categoryName } from "../../shared/categories/categories.ts"
import { CategorySelect } from "../../shared/categories/CategorySelect.tsx"
import { addDays } from "../../shared/format/expenseDate.ts"
import { localToday } from "../../shared/format/localDate.ts"
import { formatRupiah, formatRupiahDigits } from "../../shared/format/rupiah.ts"
import { formatDayMonthYear } from "../../shared/format/shortDate.ts"
import { DatePickerPanel } from "../../shared/ui/DatePickerPanel.tsx"
import { errorsFromApi, useEditExpense, useExpenses } from "../expenses/index.ts"
import { edits } from "./expenseEdits.ts"

/** What a refused edit says, as one line. */
const editError = (error: unknown) => Object.values(errorsFromApi(error))[0] ?? "Couldn't save."

const chip =
  "inline-flex h-7 min-w-0 max-w-full shrink-0 items-center gap-1.5 rounded-sm px-2 text-sm font-medium transition-colors duration-(--motion-color) data-disabled:opacity-70 disabled:opacity-70"
const filledChip = `${chip} bg-surface-2 group-data-[state=confirmed]:bg-surface enabled:hover:bg-line data-open:bg-line`
const emptyChip = `${chip} border border-dashed border-ring text-text-muted enabled:hover:bg-surface-2 data-open:bg-surface-2`

const popover =
  "group z-20 w-64 rounded-lg border border-line bg-surface p-2 shadow-pop transition-[opacity,translate] duration-(--motion-color) data-ending-style:translate-y-(--motion-shift) data-ending-style:opacity-0 data-starting-style:translate-y-(--motion-shift) data-starting-style:opacity-0 " +
  "data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-xl data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:border-0 data-[presentation=sheet]:px-5 data-[presentation=sheet]:pt-4 data-[presentation=sheet]:pb-[max(env(safe-area-inset-bottom),24px)] data-[presentation=sheet]:[--sheet-backdrop:rgb(28_25_23/0.3)]"

const iconProps = { "aria-hidden": true, size: 13, className: "shrink-0 text-text-muted" } as const

/** True for 1.5s after `flash()`: the edited chip's ✓ (DESIGN, "Expense card fields"). */
const useSaved = () => {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const timer = saved ? setTimeout(() => setSaved(false), 1500) : undefined
    return () => clearTimeout(timer)
  }, [saved])
  return [saved, () => setSaved(true)] as const
}

const ChipIcon = ({ saved, icon }: { readonly saved: boolean; readonly icon: ReactNode }) =>
  saved ? <Check {...iconProps} className="shrink-0 text-text" /> : icon

/** Merchants used in the last 90 days, newest first, for one-tap fixes. */
const RecentMerchants = ({
  current,
  onPick,
}: {
  readonly current: string
  readonly onPick: (merchant: string) => void
}) => {
  const recent = useExpenses({ from: addDays(localToday(), -90) })
  const merchants = [
    ...new Set((recent.data ?? []).map((expense) => expense.merchant).filter((m) => m !== null)),
  ]
    .filter((merchant) => merchant !== current)
    .slice(0, 3)
  if (merchants.length === 0) return null
  return (
    <div className="flex flex-col">
      <span className="px-2 pt-1 pb-0.5 text-xs text-text-muted">Recent</span>
      {merchants.map((merchant) => (
        <button
          key={merchant}
          type="button"
          onClick={() => onPick(merchant)}
          className="flex h-8 items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors duration-(--motion-color) hover:bg-surface-2 group-data-[presentation=sheet]:h-11 group-data-[presentation=sheet]:text-md"
        >
          <Store {...iconProps} />
          <span className="truncate">{merchant}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The input inside a field's popover: Enter saves with a `PATCH` and closes,
 * Escape or a press outside closes without saving. `toPayload` turns what
 * was typed into the edit, or a message shown under the input.
 */
const FieldEditor = ({
  expense,
  label,
  initial,
  toPayload,
  onDone,
  prefix,
  hint = "↵ save · esc",
  removable = false,
  recents = false,
}: {
  readonly expense: Expense
  readonly label: string
  readonly initial: string
  readonly toPayload: (typed: string) => EditExpense | string
  readonly onDone: (saved: boolean) => void
  readonly prefix?: string
  readonly hint?: string
  readonly removable?: boolean
  readonly recents?: boolean
}) => {
  const edit = useEditExpense(expense.id)
  const [typed, setTyped] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  const save = (text: string) => {
    if (edit.isPending) return
    if (text.trim() === initial.trim()) return onDone(false)
    const payload = toPayload(text)
    if (typeof payload === "string") return setError(payload)
    edit.mutate(payload, {
      onSuccess: () => onDone(true),
      onError: (failure) => setError(editError(failure)),
    })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save(typed)
      }}
      className="flex flex-col gap-1.5"
    >
      <span className="flex h-9 items-center gap-1.5 rounded-sm border border-ring bg-surface px-2.5 has-[input[aria-invalid=true]]:border-danger group-data-[presentation=sheet]:h-12">
        {prefix === undefined ? null : (
          <span aria-hidden="true" className="font-num text-text-muted">
            {prefix}
          </span>
        )}
        <Input
          data-autofocus
          aria-label={label}
          aria-invalid={error !== null}
          autoComplete="off"
          {...(prefix === undefined ? {} : { inputMode: "decimal" as const })}
          value={typed}
          disabled={edit.isPending}
          onValueChange={(value) => {
            setTyped(value)
            setError(null)
          }}
          className={`min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:outline-none group-data-[presentation=sheet]:text-lg ${prefix === undefined ? "" : "font-num font-semibold tabular"}`}
        />
      </span>
      {error === null ? null : (
        <span role="alert" className="px-0.5 text-xs text-danger">
          {error}
        </span>
      )}
      {recents ? <RecentMerchants current={initial} onPick={save} /> : null}
      <span className="flex items-center justify-between gap-2 px-0.5 pt-0.5 text-xs text-text-muted">
        {removable && initial !== "" ? (
          <button
            type="button"
            onClick={() => save("")}
            className="rounded-sm text-danger hover:underline"
          >
            Remove {label}
          </button>
        ) : (
          <span />
        )}
        <span aria-hidden="true" className="pointer-coarse:hidden">
          {hint}
        </span>
      </span>
      <button
        type="submit"
        disabled={edit.isPending}
        className="mt-3 hidden h-12 rounded-sm bg-accent text-md font-semibold text-accent-fg transition-opacity duration-(--motion-color) disabled:opacity-70 group-data-[presentation=sheet]:block"
      >
        Save
      </button>
    </form>
  )
}

/** A field that opens its editor in a popover (a sheet on small touch screens). */
const PopoverField = ({
  label,
  disabled,
  triggerClassName,
  trigger,
  editor,
}: {
  readonly label: string
  readonly disabled: boolean
  readonly triggerClassName: string
  readonly trigger: (saved: boolean) => ReactNode
  readonly editor: (onDone: (saved: boolean) => void) => ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const [saved, flash] = useSaved()
  return (
    <Popover open={open} onOpenChange={setOpen} presentation="auto">
      <PopoverTrigger aria-label={`Edit ${label}`} disabled={disabled} className={triggerClassName}>
        {trigger(saved)}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={16}
        initialFocus="[data-autofocus]"
        className={popover}
      >
        <PopoverTitle className="sr-only group-data-[presentation=sheet]:not-sr-only group-data-[presentation=sheet]:mb-3 group-data-[presentation=sheet]:block group-data-[presentation=sheet]:font-semibold">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </PopoverTitle>
        {editor((didSave) => {
          setOpen(false)
          if (didSave) flash()
        })}
      </PopoverContent>
    </Popover>
  )
}

/** Merchant or note as a chip; dashed "+ Merchant" when there is none. */
const TextChip = ({
  expense,
  label,
  value,
  icon,
  toPayload,
  disabled,
}: {
  readonly expense: Expense
  readonly label: "merchant" | "note"
  readonly value: string | null
  readonly icon: ReactNode
  readonly toPayload: (typed: string) => EditExpense
  readonly disabled: boolean
}) => (
  <PopoverField
    label={label}
    disabled={disabled}
    triggerClassName={value === null ? emptyChip : `${filledChip} max-w-80`}
    trigger={(saved) =>
      value === null ? (
        <>
          <Plus {...iconProps} />
          {label === "merchant" ? "Merchant" : "Note"}
        </>
      ) : (
        <>
          <ChipIcon saved={saved} icon={icon} />
          <span className="truncate">{value}</span>
        </>
      )
    }
    editor={(onDone) => (
      <FieldEditor
        expense={expense}
        label={label}
        initial={value ?? ""}
        toPayload={toPayload}
        onDone={onDone}
        removable
        recents={label === "merchant"}
      />
    )}
  />
)

/** The amount stays the headline; it opens its editor like a chip does. */
const AmountField = ({
  expense,
  disabled,
}: {
  readonly expense: Expense
  readonly disabled: boolean
}) => (
  <PopoverField
    label="amount"
    disabled={disabled}
    triggerClassName={`-mx-1 shrink-0 rounded-sm px-1 font-num text-2xl tabular transition-colors duration-(--motion-color) enabled:hover:bg-surface-2 data-open:bg-surface-2 ${expense.amount < 0 ? "text-danger" : ""}`}
    trigger={() => formatRupiah(expense.amount)}
    editor={(onDone) => (
      <FieldEditor
        expense={expense}
        label="amount"
        initial={formatRupiahDigits(expense.amount)}
        toPayload={edits.amount}
        onDone={onDone}
        prefix="Rp"
        hint="56rb, 56.000 or 56k"
      />
    )}
  />
)

/** The date chip opens the app's Date picker; a pick saves at once. */
const DateChipField = ({
  expense,
  disabled,
}: {
  readonly expense: Expense
  readonly disabled: boolean
}) => {
  const edit = useEditExpense(expense.id)
  const [saved, flash] = useSaved()
  const [error, setError] = useState<string | null>(null)
  const today = localToday()
  return (
    <>
      <DatePicker
        value={expense.occurredAt}
        onValueChange={(next) => {
          if (typeof next !== "string" || next === expense.occurredAt) return
          setError(null)
          edit.mutate(
            { occurredAt: next },
            { onSuccess: flash, onError: (failure) => setError(editError(failure)) },
          )
        }}
        today={today}
        max={today}
        locale="en-US"
        weekStartsOn={1}
        showOutsideDays
        fixedWeeks
        presentation="auto"
        disabled={disabled || edit.isPending}
      >
        <DatePickerTrigger aria-label="Edit date" className={filledChip}>
          <ChipIcon saved={saved} icon={<Calendar {...iconProps} />} />
          {formatDayMonthYear(expense.occurredAt)}
        </DatePickerTrigger>
        <DatePickerPanel value={expense.occurredAt} today={today} side="bottom" />
      </DatePicker>
      {error === null ? null : (
        <span role="alert" className="basis-full text-xs text-danger">
          {error}
        </span>
      )}
    </>
  )
}

/**
 * The Category chip: the correction path for a wrong Category (ADR-0004).
 * Picking one is a `PATCH` on the Expense.
 */
export const CategoryEdit = ({
  expense,
  disabled = false,
}: {
  readonly expense: Expense
  readonly disabled?: boolean
}) => {
  const edit = useEditExpense(expense.id)
  const [saved, flash] = useSaved()
  return (
    <CategorySelect
      value={String(expense.categoryId)}
      disabled={disabled || edit.isPending}
      onValueChange={(value) => {
        if (value !== null && Number(value) !== expense.categoryId)
          edit.mutate({ categoryId: Number(value) }, { onSuccess: flash })
      }}
      triggerLabel="Edit category"
      triggerClassName={filledChip}
      leadingIcon={<ChipIcon saved={saved} icon={<Tag {...iconProps} />} />}
    />
  )
}

const StaticChip = ({
  icon,
  children,
}: {
  readonly icon: ReactNode
  readonly children: string
}) => (
  <span className={`${chip} bg-surface-2 group-data-[state=confirmed]:bg-surface`}>
    {icon}
    <span className="truncate">{children}</span>
  </span>
)

/**
 * An Expense card's fields, shared by the Draft and Expense cards (DESIGN,
 * "Expense card fields"): the amount with `trailing` beside it, then a row of
 * chips — merchant, date, Category, note — each opening its own editor.
 * A missing merchant or note is a dashed slot. `readOnly` shows plain chips.
 */
export const ExpenseFields = ({
  expense,
  trailing = null,
  disabled = false,
  readOnly = false,
}: {
  readonly expense: Expense
  readonly trailing?: ReactNode
  readonly disabled?: boolean
  readonly readOnly?: boolean
}) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      {readOnly ? (
        <span className="shrink-0 font-num text-2xl tabular">{formatRupiah(expense.amount)}</span>
      ) : (
        <AmountField expense={expense} disabled={disabled} />
      )}
      {trailing === null ? null : (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </div>
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {readOnly ? (
        <>
          {expense.merchant === null ? null : (
            <StaticChip icon={<Store {...iconProps} />}>{expense.merchant}</StaticChip>
          )}
          <StaticChip icon={<Calendar {...iconProps} />}>
            {formatDayMonthYear(expense.occurredAt)}
          </StaticChip>
          <StaticChip icon={<Tag {...iconProps} />}>{categoryName(expense.categoryId)}</StaticChip>
          {expense.note === null ? null : (
            <StaticChip icon={<StickyNote {...iconProps} />}>{expense.note}</StaticChip>
          )}
        </>
      ) : (
        <>
          <TextChip
            expense={expense}
            label="merchant"
            value={expense.merchant}
            icon={<Store {...iconProps} />}
            toPayload={edits.merchant}
            disabled={disabled}
          />
          <DateChipField expense={expense} disabled={disabled} />
          <CategoryEdit expense={expense} disabled={disabled} />
          <TextChip
            expense={expense}
            label="note"
            value={expense.note}
            icon={<StickyNote {...iconProps} />}
            toPayload={edits.note}
            disabled={disabled}
          />
        </>
      )}
    </div>
  </>
)
