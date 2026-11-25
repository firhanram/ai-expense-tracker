import { HttpApi, HttpApiMiddleware } from "effect/http-api"
import { ExpensesGroup } from "./expenses/ExpensesApi.ts"
import { HealthGroup } from "./health/HealthApi.ts"

/** The whole HTTP surface, mounted under `/api`. Shared by the Worker and the SPA. */
export class Api extends HttpApi.make("expense-tracker")
  .add(HealthGroup)
  .add(ExpensesGroup)
  .prefix("/api")
  .middleware(HttpApiMiddleware.ProblemDetails) {}
