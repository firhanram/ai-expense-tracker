import { ExpenseStatus } from "@expense/contract"
import { defineAction, defineComponent } from "@openuidev/lang-core"
import { z } from "zod"

// Zod 4 appears here and nowhere else (ADR-0006).
//
// KEY ORDER IN EVERY z.object IS THE POSITIONAL-ARGUMENT CONTRACT. The model
// writes `SpendingChart("2026-01-01", "2026-01-31", "month", "bar")`; reordering
// a field silently mis-maps every past and future program. Never reorder.
//
// Components take ids and ranges, never the values they display (ADR-0001).
// Each is defined without a renderer (`component: null`) so the Worker can
// generate the prompt and parse programs without React; the web app pairs
// the same definitions with its React components.

const ExpenseId = z.string().describe("An Expense id returned by a tool; never invent one")
const IsoDate = z.string().describe("YYYY-MM-DD")

export const DraftExpenseCard = defineComponent({
  name: "DraftExpenseCard",
  description:
    "A Draft Expense the user has not approved yet, shown with its own Confirm and Discard buttons. Use the id a tool returned.",
  props: z.object({ id: ExpenseId }),
  component: null,
})

export const ExpenseCard = defineComponent({
  name: "ExpenseCard",
  description: "One recorded Expense, fetched by id.",
  props: z.object({ id: ExpenseId }),
  component: null,
})

export const ExpenseList = defineComponent({
  name: "ExpenseList",
  description:
    "A list of Expenses fetched by the app, filtered by status and an optional date range and Category id.",
  props: z.object({
    status: z.enum(ExpenseStatus.literals),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
    categoryId: z.number().int().describe("A Category id returned by a tool").optional(),
  }),
  component: null,
})

export const SpendingChart = defineComponent({
  name: "SpendingChart",
  description:
    "A chart of confirmed spending totals the server computes for a date range. Never pass figures; pass the range.",
  props: z.object({
    from: IsoDate,
    to: IsoDate,
    groupBy: z.enum(["category", "month"]),
    chartType: z.enum(["bar", "line"]),
  }),
  component: null,
})

/**
 * The root container. `openuiLibrary` (with its `Stack`) ships only in
 * `@openuidev/react-ui`, which PLAN rules out, so the library defines its own.
 */
export const Stack = defineComponent({
  name: "Stack",
  description: "Shows its children top to bottom. Every program's root.",
  props: z.object({
    children: z.array(
      z.union([DraftExpenseCard.ref, ExpenseCard.ref, ExpenseList.ref, SpendingChart.ref]),
    ),
  }),
  component: null,
})

/**
 * What the Draft Expense card's buttons do. Client-only: the web app adds
 * these to its own library and handles them by calling the API. They are
 * kept out of `library` because a library action is advertised in the
 * system prompt, and the model must never be told it can confirm (ADR-0007).
 */
export const ConfirmExpense = defineAction({
  name: "ConfirmExpense",
  description: "Confirm a Draft Expense",
  params: z.object({ id: ExpenseId }),
})

export const DiscardExpense = defineAction({
  name: "DiscardExpense",
  description: "Discard a Draft Expense",
  params: z.object({ id: ExpenseId }),
})

export const components = [Stack, DraftExpenseCard, ExpenseCard, ExpenseList, SpendingChart]
