import { ChevronLeft, ChevronRight } from "lucide-react"
import { addMonths, formatMonth, formatMonthShort, type Month } from "./month.ts"

const stepButton =
  "flex size-6 items-center justify-center rounded-sm text-text-muted transition-colors duration-(--motion-color) hover:bg-surface-2 hover:text-text"

/** `◀ November 2026 ▶`: the month's heading between buttons to the month before and after. */
export const MonthStepper = ({
  month,
  onMonthChange,
  className = "",
}: {
  readonly month: Month
  readonly onMonthChange: (month: Month) => void
  readonly className?: string
}) => (
  <div className={`flex items-center gap-1 ${className}`}>
    <button
      type="button"
      aria-label="Previous month"
      className={`${stepButton} -ml-1.5`}
      onClick={() => onMonthChange(addMonths(month, -1))}
    >
      <ChevronLeft aria-hidden="true" size={16} />
    </button>
    <h2 aria-label={formatMonth(month)} className="text-lg">
      <span aria-hidden="true" className="md:hidden">
        {formatMonthShort(month)}
      </span>
      <span aria-hidden="true" className="hidden md:inline">
        {formatMonth(month)}
      </span>
    </h2>
    <button
      type="button"
      aria-label="Next month"
      className={stepButton}
      onClick={() => onMonthChange(addMonths(month, 1))}
    >
      <ChevronRight aria-hidden="true" size={16} />
    </button>
  </div>
)
