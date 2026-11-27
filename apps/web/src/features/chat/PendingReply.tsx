import { useEffect, useState } from "react"
import type { PendingShape } from "./replyPhase.ts"

/** Whole seconds since the component mounted, ticking once a second. */
const useElapsedSeconds = () => {
  const [started] = useState(() => performance.now())
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds(Math.floor((performance.now() - started) / 1000)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [started])
  return seconds
}

/** The counter shows from here on; earlier, a number only adds noise. */
const showElapsedAfter = 3
/** Past this, a calm line says it is slow. Slow is not an error. */
const slowAfter = 8

/**
 * What the reply is doing while nothing it says has arrived yet: three
 * rippling dots and a phase label with a light sweeping across it. It fades
 * in after 150ms, so a reply that starts at once never flashes it.
 */
export const ThinkingIndicator = ({ label }: { readonly label: string }) => {
  const seconds = useElapsedSeconds()
  return (
    <div className="animate-thinking-in flex flex-col gap-1">
      <p className="flex items-center gap-2.5 text-sm">
        <span aria-hidden="true" className="flex h-4 w-7 items-center justify-center gap-1">
          <span className="thinking-dot size-1.5 rounded-full bg-text" />
          <span className="thinking-dot size-1.5 rounded-full bg-text" />
          <span className="thinking-dot size-1.5 rounded-full bg-text" />
        </span>
        <span key={label} className="animate-message-in">
          <span className="shimmer-text font-medium">{label}</span>
        </span>
        {seconds >= showElapsedAfter ? (
          <span aria-hidden="true" className="tabular font-num text-xs text-text-muted">
            · {seconds}s
          </span>
        ) : null}
      </p>
      {seconds >= slowAfter ? (
        <p className="animate-message-in pl-[38px] text-sm text-text-muted">
          Taking longer than usual.
        </p>
      ) : null}
    </div>
  )
}

const Bar = ({ className }: { readonly className: string }) => (
  <span className={`shimmer-block block rounded-sm ${className}`} />
)

const DraftSkeleton = () => (
  <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
    <div className="flex items-center justify-between">
      <Bar className="h-6 w-36" />
      <Bar className="h-[22px] w-20 rounded-full" />
    </div>
    <Bar className="h-3 w-44 max-w-full" />
    <div className="flex gap-2 pt-1">
      <Bar className="h-8 w-[76px] rounded-md" />
      <Bar className="h-8 w-[72px] rounded-md" />
    </div>
  </div>
)

const chartRows = ["w-[72%]", "w-[54%]", "w-[42%]", "w-[30%]", "w-[22%]"]

const ChartSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
    <div className="flex justify-between">
      <Bar className="h-4 w-28" />
      <Bar className="h-5 w-24" />
    </div>
    <div className="flex flex-col gap-2.5">
      {chartRows.map((width) => (
        <div key={width} className="flex items-center gap-3">
          <Bar className="h-2.5 w-20 shrink-0" />
          <Bar className={`h-3.5 ${width}`} />
        </div>
      ))}
    </div>
  </div>
)

const ListSkeleton = () => (
  <div className="flex flex-col rounded-lg border border-line bg-surface px-4">
    {["w-32", "w-24", "w-40"].map((width) => (
      <div
        key={width}
        className="flex h-14 items-center gap-3 border-b border-line last:border-b-0"
      >
        <Bar className="h-3 w-12" />
        <Bar className={`ml-6 h-3 ${width}`} />
        <Bar className="ml-auto h-3 w-20" />
      </div>
    ))}
  </div>
)

/**
 * Where a streaming program's block will land, in its shape, so the answer
 * takes the space it will keep instead of pushing the page when it arrives.
 */
export const ReplySkeleton = ({ shape }: { readonly shape: PendingShape }) => (
  <div aria-hidden="true" className="animate-message-in" data-skeleton={shape}>
    {shape === "draft" ? <DraftSkeleton /> : null}
    {shape === "chart" ? <ChartSkeleton /> : null}
    {shape === "list" ? <ListSkeleton /> : null}
  </div>
)
