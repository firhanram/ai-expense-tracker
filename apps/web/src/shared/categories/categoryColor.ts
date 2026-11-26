import type { CategoryId } from "@expense/contract"
import { categories } from "./categories.ts"

/** A step of the five-colour chart ramp, `--chart-1` to `--chart-5`. */
export type ChartStep = 1 | 2 | 3 | 4 | 5

const steps: ReadonlyArray<ChartStep> = [1, 2, 3, 4, 5]

/**
 * The Category's step of the chart ramp: the ramp cycled over the seeded
 * order (DESIGN.md "Spending chart"), so a Category keeps its colour in every
 * Report and in the filter's swatches. Unknown ids get Other's.
 */
export const categoryChartStep = (id: CategoryId): ChartStep => {
  const index = categories.findIndex((category) => category.id === id)
  const position = index === -1 ? categories.length - 1 : index
  return steps[position % steps.length] ?? 1
}

/** The Category's chart colour as a CSS `var()`. */
export const categoryColor = (id: CategoryId): string => `var(--chart-${categoryChartStep(id)})`

/** Other is a classification failure rather than a real bucket, so it is drawn outlined. */
export const otherCategoryId: CategoryId = 11
