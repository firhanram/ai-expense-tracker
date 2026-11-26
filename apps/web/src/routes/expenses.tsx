import { createRoute } from "@tanstack/react-router"
import { ExpenseListPage } from "../features/expenses/ExpenseListPage.tsx"
import { rootRoute } from "./root.tsx"

export const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/expenses",
  component: ExpenseListPage,
})
