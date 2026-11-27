import { chatRoute } from "./chat.tsx"
import { expensesRoute } from "./expenses.tsx"
import { rootRoute } from "./root.tsx"

export const routeTree = rootRoute.addChildren([chatRoute, expensesRoute])
