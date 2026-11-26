import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { ok } from "../ApiResponse.ts"
import { Report, ReportQuery } from "./Report.ts"

/** Reports are reads: there is no `POST /reports` (PLAN, "API"). */
export class ReportsGroup extends HttpApiGroup.make("reports").add(
  HttpApiEndpoint.get("get", "/reports", {
    query: ReportQuery,
    success: ok(Report),
  }),
) {}
