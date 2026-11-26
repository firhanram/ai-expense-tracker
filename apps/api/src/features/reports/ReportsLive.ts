import { Api } from "@expense/contract"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { captureServices } from "../../captureServices.ts"
import { spendingReport } from "./SpendingReport.ts"

/** `GET /api/reports`: figures for the client's range, computed in SQL. */
export const ReportsLive = HttpApiBuilder.group(Api, "reports", (handlers) =>
  Effect.gen(function* () {
    const withSql = yield* captureServices(SqlClient.SqlClient)
    return handlers.handle("get", ({ query }) => withSql(spendingReport(query)))
  }),
)
