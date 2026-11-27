import type { IsoDate } from "@expense/contract"
import { DatePicker, DatePickerTrigger } from "@ui-sdk/react/date-picker"
import { Calendar, ChevronDown } from "lucide-react"
import { expenseDateLabel } from "../../shared/format/expenseDate.ts"
import { DatePickerPanel } from "../../shared/ui/DatePickerPanel.tsx"

/**
 * The composer's Date chip: the date sent with the next message as
 * `clientDate`, for back-dating. Opens upward, since the composer sits low.
 */
export const DateChip = ({
  value,
  today,
  onChange,
}: {
  readonly value: IsoDate
  readonly today: IsoDate
  readonly onChange: (date: IsoDate) => void
}) => {
  const label = expenseDateLabel(value, today)

  return (
    <DatePicker
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next)
      }}
      today={today}
      max={today}
      locale="en-US"
      weekStartsOn={1}
      showOutsideDays
      fixedWeeks
    >
      <DatePickerTrigger
        aria-label={`Expense date: ${label}`}
        className="group flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium transition-colors duration-(--motion-color) hover:bg-surface-2 data-open:border-ring data-open:bg-surface-2"
      >
        <Calendar aria-hidden="true" size={14} className="text-text-muted" />
        {label}
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="text-text-muted transition-transform duration-(--motion-color) group-data-open:rotate-180"
        />
      </DatePickerTrigger>
      <DatePickerPanel value={value} today={today} side="top" />
    </DatePicker>
  )
}
