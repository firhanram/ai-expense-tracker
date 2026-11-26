import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"

/** Which Expenses the list shows: confirmed (the default) or Drafts awaiting the user. */
export type ListView = "confirmed" | "draft"

const item =
  "relative z-10 flex h-[22px] cursor-default items-center rounded-sm px-2 text-sm font-medium text-text-muted transition-colors duration-(--motion-color) data-checked:text-text"

/** A small Confirmed | Drafts switch, drawn like the top bar's nav track. */
export const StatusSwitch = ({
  value,
  onChange,
}: {
  value: ListView
  onChange: (view: ListView) => void
}) => (
  <SegmentedControl
    aria-label="Show"
    value={value}
    onValueChange={(next) => {
      if (next === "confirmed" || next === "draft") onChange(next)
    }}
    className="relative isolate inline-flex h-7 items-center gap-0.5 rounded-md bg-surface-2 p-[3px]"
  >
    <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) z-0 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-sm bg-surface shadow-xs transition-[left,width] duration-(--motion-layout) data-[activation-direction=none]:transition-none" />
    <SegmentedControlItem value="confirmed" className={item}>
      Confirmed
    </SegmentedControlItem>
    <SegmentedControlItem value="draft" className={item}>
      Drafts
    </SegmentedControlItem>
  </SegmentedControl>
)
