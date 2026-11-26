import type { IsoDate, Report, ReportGroupBy } from "@expense/contract"
import { useId } from "react"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { CardLine, CardSkeleton } from "../generated-ui/CardSkeleton.tsx"
import { CategoryBars } from "./CategoryBars.tsx"
import { MonthChart } from "./MonthChart.tsx"
import { monthLabel, rangeTitle } from "./rangeTitle.ts"
import { useReport } from "./useReport.ts"

export interface SpendingChartProps {
  readonly from: IsoDate
  readonly to: IsoDate
  readonly groupBy: ReportGroupBy
  readonly chartType: "bar" | "line"
}

/** The figures in the order the chart draws them: Categories largest first, months oldest first. */
const figures = (report: Report) =>
  report.groupBy === "category"
    ? report.totals
        .map((total) => ({ name: total.label, amount: total.amount }))
        .toSorted((a, b) => b.amount - a.amount)
    : report.totals.map((total) => ({ name: monthLabel(total.label), amount: total.amount }))

const SpendingChartCard = ({
  report,
  chartType,
}: {
  readonly report: Report
  readonly chartType: SpendingChartProps["chartType"]
}) => {
  const titleId = useId()
  const groupId = useId()
  return (
    <figure
      aria-labelledby={`${titleId} ${groupId}`}
      className="m-0 flex flex-col gap-4 rounded-lg border border-line bg-surface p-4"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={titleId} className="text-md font-semibold">
            {rangeTitle(report)}
          </p>
          <p id={groupId} className="text-sm text-text-muted">
            by {report.groupBy}
          </p>
        </div>
        <p
          data-refund={report.total < 0}
          className="shrink-0 font-num text-lg tabular data-[refund=true]:text-danger"
        >
          {formatRupiah(report.total)}
        </p>
      </header>
      <div aria-hidden="true">
        {report.groupBy === "category" ? (
          <CategoryBars totals={report.totals} />
        ) : (
          <MonthChart totals={report.totals} chartType={chartType} />
        )}
      </div>
      <ul aria-label={`Spending figures, ${rangeTitle(report)}`} className="sr-only">
        {figures(report).map((figure) => (
          <li key={figure.name}>{`${figure.name}: ${formatRupiah(figure.amount)}`}</li>
        ))}
      </ul>
    </figure>
  )
}

/**
 * A chart of the server's Report for a range (ADR-0001): the model passes the
 * range and the presentation, never figures, and the chart computes nothing
 * but layout. Recharts stays inside this feature.
 */
export const SpendingChartView = ({ from, to, groupBy, chartType }: SpendingChartProps) => {
  const report = useReport({ from, to, groupBy })
  if (report.isPending) return <CardSkeleton label="Spending chart" />
  if (report.isError) return <CardLine>Couldn't load this report</CardLine>
  if (report.data.totals.length === 0) return <CardLine>No expenses in this range</CardLine>
  return <SpendingChartCard report={report.data} chartType={chartType} />
}
