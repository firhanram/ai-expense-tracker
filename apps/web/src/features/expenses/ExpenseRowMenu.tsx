import type { Expense } from "@expense/contract"
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIcon,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import type { Ref } from "react"
import { categoryName } from "../../shared/categories/categories.ts"
import { formatRupiah } from "../../shared/format/rupiah.ts"
import { formatDayMonthYear } from "../../shared/format/shortDate.ts"
import { useMediaQuery } from "../../shared/media/useMediaQuery.ts"

export type RowAction = "edit" | "delete"

const item =
  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-surface-2 data-destructive:text-danger " +
  "data-[presentation=sheet]:h-13 data-[presentation=sheet]:gap-3 data-[presentation=sheet]:px-4 data-[presentation=sheet]:text-md"

/**
 * The row's Edit and Delete. On desktop a `⋯` button opens them as a small
 * menu; below `md` the same trigger covers the whole row and opens them as a
 * bottom sheet headed by the row itself.
 */
export const ExpenseRowMenu = ({
  expense,
  label,
  triggerRef,
  onAction,
}: {
  expense: Expense
  label: string
  triggerRef: Ref<HTMLButtonElement>
  onAction: (action: RowAction) => void
}) => {
  const sheet = useMediaQuery("(width < 48rem)")
  const presentation = sheet ? "sheet" : "popover"
  const items = (
    <>
      <MenuItem value="edit" data-presentation={presentation} className={item}>
        <MenuItemIcon>
          <Pencil aria-hidden="true" size={sheet ? 20 : 14} />
        </MenuItemIcon>
        Edit
      </MenuItem>
      <MenuItem value="delete" destructive data-presentation={presentation} className={item}>
        <MenuItemIcon>
          <Trash2 aria-hidden="true" size={sheet ? 20 : 14} />
        </MenuItemIcon>
        Delete
      </MenuItem>
    </>
  )

  return (
    <Menu
      presentation={presentation}
      onAction={(value) => {
        if (value === "edit" || value === "delete") onAction(value)
      }}
    >
      <MenuTrigger
        ref={triggerRef}
        aria-label={`Actions for ${label}`}
        className="flex size-8 items-center justify-center rounded-sm text-text-muted transition-colors duration-(--motion-color) hover:bg-surface-2 hover:text-text data-open:text-text max-md:absolute max-md:inset-0 max-md:size-auto max-md:rounded-none max-md:hover:bg-transparent"
      >
        <Ellipsis aria-hidden="true" size={16} className="max-md:hidden" />
      </MenuTrigger>
      <MenuContent
        align="end"
        sideOffset={4}
        finalFocus="none"
        className="min-w-36 rounded-lg border border-line bg-surface p-1 text-text shadow-pop data-[presentation=sheet]:w-full data-[presentation=sheet]:min-w-0 data-[presentation=sheet]:rounded-t-xl data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:border-0 data-[presentation=sheet]:p-0 data-[presentation=sheet]:pb-[max(env(safe-area-inset-bottom),24px)] data-[presentation=sheet]:[--sheet-backdrop:rgb(28_25_23/0.3)]"
      >
        {sheet ? (
          <MenuGroup>
            <span
              aria-hidden="true"
              className="mx-auto mt-2 mb-3 block h-1 w-9 rounded-full bg-line"
            />
            <MenuGroupLabel className="mx-4 flex items-start justify-between gap-3 border-b border-line pb-3">
              <span className="min-w-0">
                <span className="block truncate text-md">
                  {expense.merchant ?? expense.note ?? "Expense"}
                </span>
                <span className="block text-sm text-text-muted">
                  {formatDayMonthYear(expense.occurredAt)} · {categoryName(expense.categoryId)}
                </span>
              </span>
              <span
                data-refund={expense.amount < 0}
                className="shrink-0 pt-1 font-num text-md tabular data-[refund=true]:text-danger"
              >
                {formatRupiah(expense.amount)}
              </span>
            </MenuGroupLabel>
            <div className="pt-2">{items}</div>
          </MenuGroup>
        ) : (
          items
        )}
      </MenuContent>
    </Menu>
  )
}
