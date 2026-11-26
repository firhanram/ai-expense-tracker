import { HttpApi, HttpApiMiddleware } from "effect/http-api"
import { ChatGroup } from "./chat/ChatApi.ts"
import { ExpensesGroup } from "./expenses/ExpensesApi.ts"
import { HealthGroup } from "./health/HealthApi.ts"
import { ReceiptsGroup } from "./receipts/ReceiptsApi.ts"
import { ReportsGroup } from "./reports/ReportsApi.ts"

/** The whole HTTP surface, mounted under `/api`. Shared by the Worker and the SPA. */
export class Api extends HttpApi.make("expense-tracker")
  .add(HealthGroup)
  .add(ExpensesGroup)
  .add(ChatGroup)
  .add(ReportsGroup)
  .add(ReceiptsGroup)
  .prefix("/api")
  .middleware(HttpApiMiddleware.ProblemDetails) {}
