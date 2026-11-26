import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { ok } from "../ApiResponse.ts"

export const HealthStatus = Schema.Struct({
  status: Schema.Literal("ok"),
})
export type HealthStatus = typeof HealthStatus.Type

export class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("check", "/health", { success: ok(HealthStatus) }),
) {}
