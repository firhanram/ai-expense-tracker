import { useState } from "react"
import { useMediaQuery } from "../../shared/media/useMediaQuery.ts"

/** Value labels are `--text-xs` `--font-num`: twelve-pixel monospace, so a digit is about 0.6em wide. */
export const labelFont = {
  fontFamily: "var(--font-num)",
  fontSize: 12,
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
} as const

/** Refund labels, below the axis at `--text-sm` (DESIGN.md "Spending chart"). */
export const refundFont = { ...labelFont, fontSize: 13 } as const

/** How wide `text` sets in `labelFont`, near enough to decide whether it fits in a bar. */
export const labelWidth = (text: string, fontSize = 12): number => text.length * fontSize * 0.6

/** Space between a value label and the end of its bar. */
export const labelInset = 8

/**
 * The 300ms entrance (bars grow from zero) on mount only: once it has run,
 * new figures from a refetch replace the old ones without animating again.
 * Reduced motion skips it.
 */
export const useEntrance = () => {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [entered, setEntered] = useState(false)
  return {
    isAnimationActive: !reduced && !entered,
    animationDuration: 300,
    animationEasing: "ease-out",
    onAnimationEnd: () => setEntered(true),
  } as const
}

/** The numeric box a Recharts shape is drawn in; Recharts leaves each field optional. */
export interface MarkBox {
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly width?: number | undefined
  readonly height?: number | undefined
}

/** A box with negative width or height (a bar below the axis) as left/top/width/height. */
export const normalise = ({ x = 0, y = 0, width = 0, height = 0 }: MarkBox) => ({
  left: Math.min(x, x + width),
  top: Math.min(y, y + height),
  width: Math.abs(width),
  height: Math.abs(height),
})
