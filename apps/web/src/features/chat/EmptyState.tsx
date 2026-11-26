import { ChartNoAxesColumn, PenLine, ReceiptText } from "lucide-react"
import type { ReactNode } from "react"

export const EmptyIntro = () => (
  <div className="flex flex-col items-center gap-2 pb-8 text-center">
    <h1 className="font-num text-[22px] leading-[30px] font-medium tracking-[-0.5px] md:text-3xl">
      Where did your money go?
    </h1>
    <p className="max-w-[440px] text-md font-normal text-text-muted">
      Type a purchase the way you'd say it, attach a receipt, or ask for a report.
    </p>
  </div>
)

const Suggestion = ({
  icon,
  title,
  hint,
  onPress,
}: {
  readonly icon: ReactNode
  readonly title: string
  readonly hint: string
  readonly onPress: () => void
}) => (
  <button
    type="button"
    onClick={onPress}
    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-surface p-3.5 text-left shadow-sm transition-colors duration-(--motion-color) hover:bg-surface-2 sm:h-[108px] sm:flex-col sm:items-start sm:gap-0"
  >
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-fg"
    >
      {icon}
    </span>
    <span className="flex w-full min-w-0 flex-col sm:mt-auto">
      <span className="text-sm font-medium">{title}</span>
      <span className="truncate text-xs font-normal text-text-muted">{hint}</span>
    </span>
  </button>
)

/** The three example prompts under the empty state's composer. */
export const Suggestions = ({
  onFill,
  onAttachReceipt,
}: {
  readonly onFill: (prompt: string) => void
  readonly onAttachReceipt: () => void
}) => (
  <div className="flex gap-3 pt-4 max-sm:flex-col">
    <Suggestion
      icon={<PenLine size={16} />}
      title="Log a purchase"
      hint="buy cloth 70rb"
      onPress={() => onFill("buy cloth 70rb")}
    />
    <Suggestion
      icon={<ReceiptText size={16} />}
      title="Scan a receipt"
      hint="attach a photo, I'll read it"
      onPress={onAttachReceipt}
    />
    <Suggestion
      icon={<ChartNoAxesColumn size={16} />}
      title="See this month"
      hint="report of this month"
      onPress={() => onFill("report of my expenses this month")}
    />
  </div>
)
