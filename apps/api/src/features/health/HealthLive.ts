import { Api } from "@expense/contract"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"

/** `GET /api/health` answers only once D1 answers, so a broken binding fails it. */
export const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return handlers.handle("check", () =>
      sql`SELECT 1`.pipe(Effect.as({ status: "ok" as const }), Effect.orDie),
    )
  }),
)
