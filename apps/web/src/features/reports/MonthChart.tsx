import type { ReportTotal } from "@expense/contract"
import {
  Bar,
  BarChart,
  type BarShapeProps,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { useLayoutEffect, useRef, useState } from "react"
import { formatRupiahDigits } from "../../shared/format/rupiah.ts"
import { monthOf } from "../expenses/month.ts"
import {
  labelFont,
  labelInset,
  labelWidth,
  normalise,
  refundFont,
  useEntrance,
} from "./chartMarks.ts"

/** One month's figure, as the server sent it. */
interface Row {
  readonly name: string
  readonly amount: number
}

const chartHeight = 200
const margin = { top: 24, right: 0, bottom: 0, left: 0 }

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && "name" in value && "amount" in value

const shortMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" })

/** `Nov`, or `Nov ’25` when the range spans years. */
const axisLabels = (totals: ReadonlyArray<ReportTotal>): ReadonlyArray<string> => {
  const years = new Set(totals.map((total) => total.label.slice(0, 4)))
  return totals.map((total) => {
    const { year, month } = monthOf(`${total.label}-01`)
    const name = shortMonth.format(new Date(Date.UTC(year, month - 1, 1)))
    return years.size > 1 ? `${name} ’${String(year).slice(2)}` : name
  })
}

const compact = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 })

/**
 * The figure in full when it fits `room`, else shortened the Indonesian way
 * (`980rb`, `2,1jt`) so twelve months still read on a phone. The visually
 * hidden list always has the full figure.
 */
const fitFigure = (amount: number, room: number): string => {
  const full = formatRupiahDigits(amount)
  if (labelWidth(full) <= room) return full
  const sign = amount < 0 ? "−" : ""
  const size = Math.abs(amount)
  if (size >= 1e9) return `${sign}${compact.format(size / 1e9)}M`
  if (size >= 1e6) return `${sign}${compact.format(size / 1e6)}jt`
  if (size >= 1e3) return `${sign}${compact.format(size / 1e3)}rb`
  return full
}

/** Figures label the marks: above a month's bar or point, below it for a refund, in `--danger`. */
const Figure = ({
  amount,
  x,
  top,
  bottom,
  room,
}: {
  readonly amount: number
  readonly x: number
  readonly top: number
  readonly bottom: number
  readonly room: number
}) => {
  const refund = amount < 0
  return (
    <text
      x={x}
      y={refund ? bottom + labelInset : top - labelInset}
      textAnchor="middle"
      dominantBaseline={refund ? "hanging" : "auto"}
      fill={refund ? "var(--danger)" : "var(--text-muted)"}
      style={refund ? refundFont : labelFont}
    >
      {fitFigure(amount, room)}
    </text>
  )
}

const MonthBar = (props: BarShapeProps) => {
  const row: unknown = props.payload
  if (!isRow(row)) return null
  const box = normalise(props)
  return (
    <g>
      <rect
        x={box.left}
        y={box.top}
        width={box.width}
        height={box.height}
        rx={3}
        fill={row.amount < 0 ? "var(--danger)" : "var(--chart-1)"}
      />
      <Figure
        amount={row.amount}
        x={box.left + box.width / 2}
        top={box.top}
        bottom={box.top + box.height}
        room={box.width + 2 * labelInset}
      />
    </g>
  )
}

interface DotProps {
  readonly cx?: number
  readonly cy?: number
  readonly payload?: unknown
  readonly index?: number
}

/** The element's width, following resizes; a line's points have no box to fit a figure in. */
const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return undefined
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

const monthAxis = (
  <XAxis
    dataKey="name"
    axisLine={{ stroke: "var(--line)" }}
    tickLine={false}
    tick={{ fill: "var(--text-muted)", fontSize: 12 }}
    interval={0}
    padding="gap"
  />
)

/**
 * Months oldest first, as the server orders them: vertical bars, or a line
 * when the model asked for one. Never re-sorted, since this is a timeline.
 */
export const MonthChart = ({
  totals,
  chartType,
}: {
  readonly totals: ReadonlyArray<ReportTotal>
  readonly chartType: "bar" | "line"
}) => {
  const entrance = useEntrance()
  const measured = useWidth()
  const labels = axisLabels(totals)
  const rows: Array<Row> = totals.map((total, i) => ({
    name: labels[i] ?? total.label,
    amount: total.amount,
  }))
  const amounts = rows.map((row) => row.amount)
  const lowest = Math.min(0, ...amounts)
  const highest = Math.max(0, ...amounts)
  const domain = [lowest, highest === 0 ? 1 : highest]
  const style = { width: "100%", height: chartHeight + (lowest < 0 ? 24 : 0) }
  const chartMargin = { ...margin, bottom: lowest < 0 ? 24 : 0 }
  const valueAxis = <YAxis hide domain={domain} />
  const zero = lowest < 0 ? <ReferenceLine y={0} stroke="var(--line)" /> : null

  if (chartType === "line") {
    const room = rows.length > 0 ? (measured.width - 48) / rows.length : 0
    const Dot = ({ cx = 0, cy = 0, payload, index }: DotProps) => {
      if (!isRow(payload)) return <g key={index} />
      const color = payload.amount < 0 ? "var(--danger)" : "var(--chart-1)"
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          <Figure amount={payload.amount} x={cx} top={cy - 2} bottom={cy + 2} room={room} />
        </g>
      )
    }
    return (
      <div ref={measured.ref}>
        <LineChart
          responsive
          data={rows}
          margin={{ ...chartMargin, left: 24, right: 24 }}
          style={style}
        >
          {monthAxis}
          {valueAxis}
          {zero}
          <Line
            type="linear"
            dataKey="amount"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={Dot}
            activeDot={false}
            {...entrance}
          />
        </LineChart>
      </div>
    )
  }

  return (
    <BarChart responsive data={rows} maxBarSize={48} margin={chartMargin} style={style}>
      {monthAxis}
      {valueAxis}
      {zero}
      <Bar dataKey="amount" shape={MonthBar} {...entrance} />
    </BarChart>
  )
}
