import { isElementNode } from "@expense/ui"
import { createParser, type OpenUIError, Renderer } from "@openuidev/react-lang"
import { useCallback, useMemo, useState } from "react"
import { useCardActions } from "./cardActions.ts"
import { webLibrary } from "./webLibrary.tsx"

const parser = createParser(webLibrary.toJSONSchema(), webLibrary.root)

/**
 * Whether a finished program has nothing to draw: it did not parse, has no
 * root, was cut off, or every child was dropped as invalid. The parser drops
 * a bad child and still returns a root (ADR-0006), so a root alone is not enough.
 */
const drawsNothing = (program: string) => {
  const { root, meta } = parser.parse(program)
  if (root === null || meta.incomplete) return true
  const children = root.props["children"]
  return !Array.isArray(children) || !children.some(isElementNode)
}

/** Errors that mean a component could not be drawn, as opposed to warnings it still renders with. */
const breaksRender = (errors: ReadonlyArray<OpenUIError>) =>
  errors.some((error) => error.severity !== "warning" && error.code === "render-error")

/** The failure line under the prose: the answer is still there as text (DESIGN, Error states). */
const TextOnly = ({ onRetry }: { readonly onRetry: (() => void) | undefined }) => (
  <p className="flex items-center gap-2 text-sm text-text-muted">
    <span>Showing text only.</span>
    {onRetry === undefined ? null : (
      <button
        type="button"
        onClick={onRetry}
        className="rounded-sm font-semibold text-text hover:underline"
      >
        Retry
      </button>
    )}
  </p>
)

/**
 * A reply's program drawn with the web library. A program that cannot be
 * drawn shows "Showing text only" instead (the prose above it stays), with
 * Retry when `onRetry` is given. Never a blank area.
 */
export const GeneratedUi = ({
  program,
  streaming,
  onRetry,
}: {
  readonly program: string
  readonly streaming: boolean
  readonly onRetry?: (() => void) | undefined
}) => {
  const onAction = useCardActions()
  const [renderFailed, setRenderFailed] = useState(false)
  const onError = useCallback((errors: Array<OpenUIError>) => {
    if (breaksRender(errors)) setRenderFailed(true)
  }, [])

  const failed = useMemo(() => !streaming && drawsNothing(program), [program, streaming])

  if (failed || (!streaming && renderFailed)) return <TextOnly onRetry={onRetry} />
  return (
    <Renderer
      response={program}
      isStreaming={streaming}
      library={webLibrary}
      onAction={onAction}
      onError={onError}
    />
  )
}
