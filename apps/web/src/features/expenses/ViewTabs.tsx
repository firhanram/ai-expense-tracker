import { TabsList, TabsTab } from "@ui-sdk/react/tabs"

/** Which Expenses the list shows: confirmed (the default) or Drafts awaiting the user. */
export type ListView = "confirmed" | "draft"

export const isListView = (value: unknown): value is ListView =>
  value === "confirmed" || value === "draft"

const tab =
  "-mb-px flex h-10 cursor-default items-center gap-1.5 border-b-2 border-transparent text-sm font-medium text-text-muted transition-colors duration-(--motion-color) hover:text-text data-selected:border-text data-selected:font-semibold data-selected:text-text"

/**
 * `Confirmed   Drafts (3)`: underline tabs on the list's top rule. The Drafts
 * tab carries a count while any wait, so they show without leaving Confirmed.
 * Sits inside the page's `Tabs` root, which owns the value.
 */
export const ViewTabs = ({ draftCount }: { readonly draftCount: number | undefined }) => (
  <TabsList aria-label="Show" className="flex items-center gap-5">
    <TabsTab value="confirmed" className={tab}>
      Confirmed
    </TabsTab>
    <TabsTab
      value="draft"
      className={tab}
      aria-description={
        draftCount ? `${draftCount} ${draftCount === 1 ? "draft" : "drafts"} waiting` : undefined
      }
    >
      Drafts
      {draftCount ? (
        <span
          aria-hidden="true"
          className="rounded-full bg-warn-bg px-1.5 font-num text-xs leading-4 font-semibold text-warn-fg tabular"
        >
          {draftCount}
        </span>
      ) : null}
    </TabsTab>
  </TabsList>
)
