import type { IsoDate } from "@expense/contract"
import {
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  DatePicker,
  DatePickerContent,
  DatePickerPreset,
  DatePickerTrigger,
} from "@ui-sdk/react/date-picker"
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { expenseDateLabel, quickPicks, shortDate } from "./expenseDate.ts"

const stepButton =
  "grid size-7 place-items-center rounded-sm text-text-muted transition-colors duration-(--motion-color) hover:bg-surface-2 hover:text-text data-disabled:text-line data-disabled:hover:bg-transparent"

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
      <DatePickerContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="z-20 w-72 rounded-lg border border-line bg-surface p-2 shadow-pop transition-[opacity,translate] duration-(--motion-color) data-ending-style:translate-y-(--motion-shift) data-ending-style:opacity-0 data-starting-style:translate-y-(--motion-shift) data-starting-style:opacity-0"
      >
        <div className="flex flex-col">
          {quickPicks(today).map((pick) => (
            <DatePickerPreset
              key={pick.label}
              value={pick.date}
              className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm font-medium transition-colors duration-(--motion-color) hover:bg-surface-2 data-selected:bg-surface-2"
            >
              <Check
                aria-hidden="true"
                size={14}
                className={pick.date === value ? "" : "invisible"}
              />
              <span>{pick.label}</span>
              <span className="ml-auto font-normal text-text-muted">{shortDate(pick.date)}</span>
            </DatePickerPreset>
          ))}
        </div>
        <hr className="my-2 border-line" />
        <div className="flex items-center justify-between px-2 py-1">
          <CalendarHeading className="text-sm font-semibold" />
          <div className="flex items-center">
            <CalendarPrevious aria-label="Previous month" className={stepButton}>
              <ChevronLeft aria-hidden="true" size={16} />
            </CalendarPrevious>
            <CalendarNext aria-label="Next month" className={stepButton}>
              <ChevronRight aria-hidden="true" size={16} />
            </CalendarNext>
          </div>
        </div>
        <CalendarGrid className="mt-1 w-full border-collapse">
          <CalendarWeekdays>
            {(index) => (
              <CalendarWeekday index={index} className="h-8 text-xs font-normal text-text-muted">
                {(weekday) => weekday.label.slice(0, 2)}
              </CalendarWeekday>
            )}
          </CalendarWeekdays>
          <CalendarWeeks>
            {(cell) =>
              cell.outside ? (
                <td
                  key={cell.date}
                  aria-hidden="true"
                  className="h-8 text-center font-num text-xs text-line"
                >
                  {Number(cell.date.slice(8))}
                </td>
              ) : (
                <CalendarDay
                  key={cell.date}
                  value={cell.date}
                  className="h-8 cursor-pointer rounded-sm text-center font-num text-xs transition-colors duration-(--motion-color) hover:bg-surface-2 data-disabled:cursor-default data-disabled:text-line data-disabled:hover:bg-transparent data-selected:bg-accent data-selected:text-accent-fg data-selected:hover:bg-accent"
                />
              )
            }
          </CalendarWeeks>
        </CalendarGrid>
      </DatePickerContent>
    </DatePicker>
  )
}
