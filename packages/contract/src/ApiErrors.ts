import { Schema } from "effect"
import { HttpApiMiddleware } from "effect/http-api"
import { apiError, errorIdField } from "./ApiResponse.ts"

/** The bearer token is missing or wrong. Sent by the Worker before any route runs. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
  ...errorIdField,
}) {}

/** One way a request failed its schema: where (`["payload", "amount"]`) and what was expected. */
export const ValidationIssue = Schema.Struct({
  path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
  message: Schema.String,
})
export type ValidationIssue = typeof ValidationIssue.Type

/** The request's params, query or body did not match the endpoint's schema. */
export class ValidationFailed extends Schema.TaggedError<ValidationFailed>()("ValidationFailed", {
  issues: Schema.Array(ValidationIssue),
  ...errorIdField,
}) {}

/** Anything unexpected. The body says nothing more; the log has the cause under the errorId. */
export class InternalError extends Schema.TaggedError<InternalError>()("InternalError", {
  ...errorIdField,
}) {}

export const internalErrorMessage =
  "Something went wrong on our side. Quote the errorId when reporting it."

/**
 * Declares the failures every endpoint can answer with besides its own, and
 * turns request validation into `VALIDATION_FAILED` on the server. Replaces
 * effect's problem-details middleware so a 400 has the same envelope as the
 * rest.
 */
export class ApiErrors extends HttpApiMiddleware.Service<ApiErrors>()("expense/ApiErrors", {
  error: [
    apiError(Unauthorized, "UNAUTHORIZED", () => "A valid bearer token is required."),
    apiError(ValidationFailed, "VALIDATION_FAILED", () => "The request is not valid."),
    apiError(InternalError, "INTERNAL_ERROR", () => internalErrorMessage),
  ],
}) {}
