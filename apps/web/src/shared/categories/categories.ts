import type { CategoryId } from "@expense/contract"

export interface Category {
  readonly id: CategoryId
  readonly name: string
}

/**
 * The seeded Categories (ADR-0004, migrations 0002 and 0004), in seeded order. The set
 * is closed and changes only with a migration, so the client carries a copy
 * rather than fetching it; the order is also the chart colour order.
 */
export const categories: ReadonlyArray<Category> = [
  { id: 1, name: "Groceries" },
  { id: 2, name: "Dining" },
  { id: 3, name: "Transport" },
  { id: 4, name: "Utilities" },
  { id: 5, name: "Housing" },
  { id: 6, name: "Shopping" },
  { id: 7, name: "Health" },
  { id: 8, name: "Entertainment" },
  { id: 9, name: "Education" },
  { id: 10, name: "Giving & family" },
  { id: 12, name: "Pets" },
  { id: 11, name: "Other" },
]

/** The Category's name, or "Other" for an id outside the seeded set. */
export const categoryName = (id: CategoryId): string =>
  categories.find((category) => category.id === id)?.name ?? "Other"
