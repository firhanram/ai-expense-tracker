import type { CategoryId } from "@expense/contract"
import { categories } from "./categories.ts"

const ramp = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const

/**
 * The Category's chart colour as a CSS `var()`: the five-step ramp cycled over
 * the seeded order (DESIGN.md "Spending chart"), so a Category keeps its colour
 * in every Report and in the filter's swatches. Unknown ids get Other's.
 */
export const categoryColor = (id: CategoryId): string => {
  const index = categories.findIndex((category) => category.id === id)
  const position = index === -1 ? categories.length - 1 : index
  return `var(${ramp[position % ramp.length]})`
}

/** Other is a classification failure rather than a real bucket, so it is drawn outlined. */
export const otherCategoryId: CategoryId = 11
