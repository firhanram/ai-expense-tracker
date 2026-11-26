import type { CategoryId, Report } from "@expense/contract"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Check, ChevronDown } from "lucide-react"
import { categories } from "../../shared/categories/categories.ts"
import { categoryColor, otherCategoryId } from "../../shared/categories/categoryColor.ts"
import { formatRupiahDigits } from "../../shared/format/rupiah.ts"

const all = "all"

const items = [
  { value: all, label: "All categories" },
  ...categories.map((category) => ({ value: String(category.id), label: category.name })),
]

const option =
  "flex h-8 cursor-default items-center gap-2.5 rounded-sm px-2 text-sm data-highlighted:bg-surface-2 data-selected:bg-surface-2"

const Total = ({ amount }: { readonly amount: number | undefined }) => (
  <span className="ml-auto pl-3 font-num text-xs text-text-muted tabular">
    {amount === undefined ? "—" : formatRupiahDigits(amount)}
  </span>
)

const CheckColumn = () => (
  <span className="flex w-3.5 shrink-0 justify-center">
    <SelectItemIndicator>
      <Check aria-hidden="true" size={14} />
    </SelectItemIndicator>
  </span>
)

/**
 * "All categories ▾": narrows the list to one Category. Its options carry the
 * month's per-Category totals, so it doubles as a quick breakdown.
 */
export const CategoryFilter = ({
  value,
  onValueChange,
  report,
}: {
  readonly value: CategoryId | null
  readonly onValueChange: (value: CategoryId | null) => void
  readonly report: Report | undefined
}) => {
  const totalOf = (id: CategoryId) =>
    report?.totals.find((total) => total.categoryId === id)?.amount

  return (
    <Select
      items={items}
      value={value === null ? all : String(value)}
      onValueChange={(next) => onValueChange(next === null || next === all ? null : Number(next))}
    >
      <SelectTrigger
        aria-label="Category filter"
        className="group flex h-7 items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 text-sm transition-colors duration-(--motion-color) hover:bg-surface-2 data-open:border-ring data-open:bg-surface-2"
      >
        <SelectValue />
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="text-text-muted group-data-open:rotate-180"
        />
      </SelectTrigger>
      <SelectContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="max-h-(--available-height) w-66 overflow-auto rounded-lg border border-line bg-surface p-1.5 shadow-pop"
      >
        <SelectItem value={all} label="All categories" className={option}>
          <CheckColumn />
          All categories
          <Total amount={report?.total} />
        </SelectItem>
        <SelectSeparator className="my-1 h-px bg-line" />
        {categories.map((category) => {
          const amount = totalOf(category.id)
          return (
            <SelectItem
              key={category.id}
              value={String(category.id)}
              label={category.name}
              className={`${option} ${amount === undefined ? "text-text-muted" : ""}`}
            >
              <CheckColumn />
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-[2px] ${
                  category.id === otherCategoryId ? "border border-text-muted" : ""
                }`}
                style={
                  category.id === otherCategoryId
                    ? undefined
                    : { background: categoryColor(category.id) }
                }
              />
              {category.name}
              <Total amount={amount} />
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
