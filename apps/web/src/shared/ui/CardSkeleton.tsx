/** A card still fetching: `--surface` at 88px with two skeleton bars, no spinner (DESIGN, Draft card states). */
export const CardSkeleton = ({ label }: { readonly label: string }) => (
  <div
    role="status"
    aria-label={label}
    aria-busy="true"
    className="flex h-[88px] flex-col justify-center gap-3 rounded-lg border border-line bg-surface p-4"
  >
    <span className="h-6 w-40 max-w-full rounded-sm bg-surface-2" />
    <span className="h-3 w-60 max-w-full rounded-sm bg-surface-2" />
  </div>
)

/** One muted line where a card would be, e.g. when its record is gone. */
export const CardLine = ({ children }: { readonly children: string }) => (
  <p className="text-sm text-text-muted">{children}</p>
)
