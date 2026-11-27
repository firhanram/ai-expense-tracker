import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { categories } from "./categories.ts"

const categoryItems = categories.map((category) => ({
  value: String(category.id),
  label: category.name,
}))

/**
 * A pick from the seeded Categories (ADR-0004), by id as a string. The
 * caller styles the trigger and gives it an icon; the options are the same
 * everywhere a Category is chosen.
 */
export const CategorySelect = ({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  triggerLabel,
  triggerClassName,
  icon = null,
  leadingIcon = null,
  contentClassName = "w-48",
}: {
  readonly value: string | null
  readonly onValueChange: (value: string | null) => void
  readonly placeholder?: string
  readonly disabled?: boolean
  /** The trigger's name when no visible label names it, e.g. "Edit category". */
  readonly triggerLabel?: string
  readonly triggerClassName: string
  readonly icon?: ReactNode
  readonly leadingIcon?: ReactNode
  readonly contentClassName?: string
}) => (
  <Select
    items={categoryItems}
    value={value}
    disabled={disabled}
    onValueChange={onValueChange}
    {...(placeholder === undefined ? {} : { placeholder })}
  >
    <SelectTrigger
      {...(triggerLabel === undefined ? {} : { "aria-label": triggerLabel })}
      className={triggerClassName}
    >
      {leadingIcon}
      <SelectValue />
      {icon}
    </SelectTrigger>
    <SelectContent
      className={`max-h-(--available-height) overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop ${contentClassName}`}
    >
      {categoryItems.map((item) => (
        <SelectItem
          key={item.value}
          value={item.value}
          className="flex cursor-default items-center justify-between rounded-sm px-2 py-1.5 text-sm data-highlighted:bg-surface-2"
        >
          {item.label}
          <SelectItemIndicator>
            <Check aria-hidden="true" size={14} />
          </SelectItemIndicator>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
