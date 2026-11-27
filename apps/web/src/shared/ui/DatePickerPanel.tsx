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
  DatePickerContent,
  DatePickerPreset,
} from "@ui-sdk/react/date-picker"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { quickPicks, shortDate } from "../format/expenseDate.ts"

const stepButton =
  "grid size-7 place-items-center rounded-sm text-text-muted transition-colors duration-(--motion-color) hover:bg-surface-2 hover:text-text data-disabled:text-line data-disabled:hover:bg-transparent"

/**
 * The date picker's popup (DESIGN, "Date picker"): Today / Yesterday /
 * 2 days ago, then a month calendar. Goes inside a `DatePicker` whose
 * `today` and `max` are the client's date; as a sheet on small touch screens.
 */
export const DatePickerPanel = ({
  value,
  today,
  side,
}: {
  readonly value: IsoDate
  readonly today: IsoDate
  readonly side: "top" | "bottom"
}) => (
  <DatePickerContent
    side={side}
    align="start"
    sideOffset={side === "top" ? 8 : 6}
    collisionPadding={16}
    className="z-20 w-72 rounded-lg border border-line bg-surface p-2 shadow-pop transition-[opacity,translate] duration-(--motion-color) data-ending-style:translate-y-(--motion-shift) data-ending-style:opacity-0 data-starting-style:translate-y-(--motion-shift) data-starting-style:opacity-0 data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-t-xl data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:border-0 data-[presentation=sheet]:px-4 data-[presentation=sheet]:pb-[max(env(safe-area-inset-bottom),24px)] data-[presentation=sheet]:[--sheet-backdrop:rgb(28_25_23/0.3)]"
  >
    <div className="flex flex-col">
      {quickPicks(today).map((pick) => (
        <DatePickerPreset
          key={pick.label}
          value={pick.date}
          className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm font-medium transition-colors duration-(--motion-color) hover:bg-surface-2 data-selected:bg-surface-2"
        >
          <Check aria-hidden="true" size={14} className={pick.date === value ? "" : "invisible"} />
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
)
