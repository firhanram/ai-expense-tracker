import type { ListExpensesQuery } from "@expense/contract"
import {
  ConfirmExpense,
  DiscardExpense,
  DraftExpenseCard,
  ExpenseCard,
  ExpenseList,
  SpendingChart,
  Stack,
} from "@expense/ui"
import { type ComponentRenderer, createLibrary } from "@openuidev/react-lang"
import { DraftExpenseCard as DraftExpenseCardView } from "./DraftExpenseCard.tsx"
import { ExpenseCard as ExpenseCardView } from "./ExpenseCard.tsx"
import { SpendingChartView } from "../reports/index.ts"
import { ExpenseList as ExpenseListView } from "./ExpenseList.tsx"

/** The props a shared definition's schema parses to. */
type PropsOf<D extends { readonly props: { readonly _zod: { readonly output: unknown } } }> =
  D["props"]["_zod"]["output"]

/** A shared definition (`component: null`) paired with the React component that draws it. */
const withView = <D extends { readonly props: { readonly _zod: { readonly output: unknown } } }>(
  definition: D,
  view: ComponentRenderer<PropsOf<D>>,
) => ({ ...definition, component: view })

const defined = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

const listQuery = (props: PropsOf<typeof ExpenseList>): ListExpensesQuery => ({
  status: props.status,
  ...(defined(props.from) ? { from: props.from } : {}),
  ...(defined(props.to) ? { to: props.to } : {}),
  ...(defined(props.categoryId) ? { categoryId: props.categoryId } : {}),
})

/**
 * The library the Renderer draws with: the definitions the model is told
 * about, plus the Draft card's actions, which only the web app knows
 * (ADR-0007). Module scope, since the Renderer's parser memoises by library.
 */
export const webLibrary = createLibrary({
  root: "Stack",
  components: [
    withView(Stack, ({ props, renderNode }) => (
      <div className="flex flex-col gap-3">{renderNode(props.children)}</div>
    )),
    withView(DraftExpenseCard, ({ props }) => <DraftExpenseCardView id={props.id} />),
    withView(ExpenseCard, ({ props }) => <ExpenseCardView id={props.id} />),
    withView(ExpenseList, ({ props }) => <ExpenseListView query={listQuery(props)} />),
    withView(SpendingChart, ({ props }) => <SpendingChartView {...props} />),
  ],
  actions: [ConfirmExpense, DiscardExpense],
})
