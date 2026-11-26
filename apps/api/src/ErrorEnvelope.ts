import {
  type ApiFailure,
  ApiErrors,
  errorCatalog,
  type ErrorCode,
  InternalError,
  internalErrorMessage,
  makeErrorId,
  ValidationFailed,
} from "@expense/contract"
import { Cause, Effect, Layer, SchemaIssue } from "effect"
import { HttpRouter, HttpServerError, HttpServerResponse } from "effect/http"
import { HttpApiError } from "effect/http-api"

/**
 * The error envelope (PLAN, "API") for what the contract cannot encode
 * itself: auth rejections, unknown routes, request validation and defects.
 * Every error response is logged once under its errorId, so an id a user
 * quotes can be found; a 5xx is logged with its cause, which never reaches
 * the body.
 */

/** One log line per error response, keyed by errorId; a 5xx carries its cause. */
const logApiError = (errorId: string, errorCode: ErrorCode, cause?: Cause.Cause<unknown>) =>
  (errorCatalog[errorCode] >= 500
    ? Effect.logError("API error", ...(cause === undefined ? [] : [cause]))
    : Effect.logInfo("API error")
  ).pipe(Effect.annotateLogs({ errorId, errorCode }))

interface ErrorResponseOptions {
  /** Logged with the errorId, never sent. */
  readonly cause?: Cause.Cause<unknown>
  readonly headers?: Record<string, string>
}

/** A failure envelope built outside the HttpApi, with a fresh, logged errorId. */
export const errorResponse = (
  errorCode: ErrorCode,
  message: string,
  options: ErrorResponseOptions = {},
) =>
  Effect.gen(function* () {
    const body: ApiFailure = {
      success: false,
      error: { errorId: makeErrorId(), errorCode, message },
    }
    yield* logApiError(body.error.errorId, errorCode, options.cause)
    return HttpServerResponse.jsonUnsafe(body, {
      status: errorCatalog[errorCode],
      headers: options.headers,
    })
  })

const isRouteNotFound = (error: unknown) =>
  HttpServerError.isHttpServerError(error) && error.reason instanceof HttpServerError.RouteNotFound

/**
 * What escapes the HttpApi becomes an envelope too: an unknown route is
 * `NOT_FOUND`, and any other failure or defect is `INTERNAL_ERROR`. A
 * response raised as a defect passes through, and an interrupt (the client
 * left) is left alone.
 */
export const ErrorEnvelope = HttpRouter.middleware(
  (httpEffect) =>
    Effect.catchCause(httpEffect, (cause) => {
      if (Cause.hasInterruptsOnly(cause)) return Effect.failCause(cause)
      for (const reason of cause.reasons) {
        if (Cause.isDieReason(reason) && HttpServerResponse.isHttpServerResponse(reason.defect)) {
          return Effect.succeed(reason.defect)
        }
        if (Cause.isFailReason(reason) && isRouteNotFound(reason.error)) {
          return errorResponse("NOT_FOUND", "No route has this method and path.")
        }
      }
      return errorResponse("INTERNAL_ERROR", internalErrorMessage, { cause })
    }),
  { global: true },
)

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1()

const toPathSegment = (segment: PropertyKey | { readonly key: PropertyKey }): string | number => {
  const key = typeof segment === "object" ? segment.key : segment
  return typeof key === "number" ? key : String(key)
}

/** Each issue's path, prefixed by the request slot it is in: `["payload", "amount"]`. */
const toIssues = (error: HttpApiError.HttpApiSchemaError) => {
  const slot = error.kind.toLowerCase()
  return formatIssues(error.cause.issue).issues.map((issue) => ({
    path: [slot, ...(issue.path ?? []).map(toPathSegment)],
    message: issue.message,
  }))
}

/** A request decoding failure is the client's (400); a response encoding failure is ours (500). */
const fromSchemaError = (
  error: HttpApiError.HttpApiSchemaError,
): Effect.Effect<never, InternalError | ValidationFailed> => {
  if (error.kind === "Body" || error.kind === "ResponseHeaders") {
    const internal = new InternalError()
    return logApiError(internal.errorId, "INTERNAL_ERROR", Cause.fail(error)).pipe(
      Effect.andThen(Effect.fail(internal)),
    )
  }
  return Effect.fail(new ValidationFailed({ issues: toIssues(error) }))
}

const recoverSchemaError = <E>(
  error: E,
): Effect.Effect<never, E | InternalError | ValidationFailed> =>
  HttpApiError.HttpApiSchemaError.is(error) ? fromSchemaError(error) : Effect.fail(error)

const hasErrorId = (error: unknown): error is { readonly errorId: string } =>
  typeof error === "object" && error !== null && "errorId" in error

/**
 * The HttpApi side: request validation becomes `ValidationFailed`, and every
 * typed error an endpoint answers with is logged under its errorId, before
 * the contract encodes it as an envelope. (`InternalError` was logged with
 * its cause where it was made.)
 */
export const ApiErrorsLive = Layer.succeed(ApiErrors, (httpEffect) =>
  httpEffect.pipe(
    Effect.catch(recoverSchemaError),
    Effect.tapError((error) =>
      hasErrorId(error) && !(error instanceof InternalError)
        ? Effect.logInfo("API error", error).pipe(Effect.annotateLogs({ errorId: error.errorId }))
        : Effect.void,
    ),
  ),
)
