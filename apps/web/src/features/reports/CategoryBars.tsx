import type { CategoryId, ReportTotal } from "@expense/contract"
import { Bar, BarChart, type BarShapeProps, ReferenceLine, XAxis, YAxis } from "recharts"
import { categoryChartStep, otherCategoryId } from "../../shared/categories/categoryColor.ts"
import { formatRupiahDigits } from "../../shared/format/rupiah.ts"
import {
  labelFont,
  labelInset,
  labelWidth,
  normalise,
  refundFont,
  useEntrance,
} from "./chartMarks.ts"

/** One bar: a Category's figure, as the server sent it. */
interface Row {
  readonly name: string
  readonly categoryId: CategoryId
  readonly amount: number
}

const rowHeight = 34
const barHeight = 24
const nameColumn = 116

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && "categoryId" in value && "amount" in value

/** Ink for a label inside a bar: `--accent-fg` on the dark steps, `--text` on the light ones. */
const insideInk = (categoryId: CategoryId) =>
  categoryId === otherCategoryId || categoryChartStep(categoryId) > 3
    ? "var(--text)"
    : "var(--accent-fg)"

/**
 * A bar in its Category's colour with its figure on it: right-aligned inside
 * when it fits, just past the end when it does not. A refund is `--danger`
 * left of the axis, its figure right of it. Other is outlined.
 */
const CategoryBar = (props: BarShapeProps) => {
  const row: unknown = props.payload
  if (!isRow(row)) return null
  const box = normalise(props)
  const top = box.top + (box.height - barHeight) / 2
  const middle = top + barHeight / 2
  const text = formatRupiahDigits(row.amount)

  if (row.amount < 0) {
    return (
      <g>
        <rect
          x={box.left}
          y={top}
          width={box.width}
          height={barHeight}
          rx={3}
          fill="var(--danger)"
        />
        <text
          x={box.left + box.width + labelInset}
          y={middle}
          dominantBaseline="central"
          fill="var(--danger)"
          style={refundFont}
        >
          {text}
        </text>
      </g>
    )
  }

  const other = row.categoryId === otherCategoryId
  const color = `var(--chart-${categoryChartStep(row.categoryId)})`
  const inside = labelWidth(text) + 2 * labelInset <= box.width
  return (
    <g>
      <rect
        x={other ? box.left + 0.5 : box.left}
        y={other ? top + 0.5 : top}
        width={Math.max(0, other ? box.width - 1 : box.width)}
        height={other ? barHeight - 1 : barHeight}
        rx={3}
        fill={other ? "var(--surface)" : color}
        stroke={other ? color : "none"}
      />
      <text
        x={inside ? box.left + box.width - labelInset : box.left + box.width + labelInset}
        y={middle}
        textAnchor={inside ? "end" : "start"}
        dominantBaseline="central"
        fill={inside ? insideInk(row.categoryId) : "var(--text-muted)"}
        style={labelFont}
      >
        {text}
      </text>
    </g>
  )
}

/** The Category's name, left-aligned in the name column at `--text-sm`. */
const CategoryName = ({
  y,
  payload,
}: {
  readonly y?: number | string
  readonly payload?: { readonly value?: unknown }
}) => (
  <text x={0} y={y} dominantBaseline="central" fill="var(--text)" fontSize={13}>
    {typeof payload?.value === "string" ? payload.value : ""}
  </text>
)

/** Horizontal bars, largest first, one per Category with spending (DESIGN.md "Spending chart"). */
export const CategoryBars = ({ totals }: { readonly totals: ReadonlyArray<ReportTotal> }) => {
  const entrance = useEntrance()
  const rows: ReadonlyArray<Row> = totals
    .map((total) => ({
      name: total.label,
      categoryId: total.categoryId ?? otherCategoryId,
      amount: total.amount,
    }))
    .toSorted((a, b) => b.amount - a.amount)
  const amounts = rows.map((row) => row.amount)
  const lowest = Math.min(0, ...amounts)
  const highest = Math.max(0, ...amounts)
  // Headroom past the largest bar keeps an outside label on the card.
  const domain = [lowest === 0 ? 0 : lowest * 1.1, highest === 0 ? 1 : highest * 1.1]

  return (
    <BarChart
      responsive
      layout="vertical"
      data={[...rows]}
      barSize={barHeight}
      barCategoryGap={rowHeight - barHeight}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      style={{ width: "100%", height: rows.length * rowHeight }}
    >
      <XAxis type="number" hide domain={domain} />
      <YAxis
        type="category"
        dataKey="name"
        width={nameColumn}
        axisLine={false}
        tickLine={false}
        tick={CategoryName}
        interval={0}
      />
      {lowest < 0 ? <ReferenceLine x={0} stroke="var(--line)" /> : null}
      <Bar dataKey="amount" shape={CategoryBar} {...entrance} />
    </BarChart>
  )
}
