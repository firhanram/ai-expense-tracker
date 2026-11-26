import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect"
import { HttpApiSchema } from "effect/http-api"

/**
 * Every API response is one of two envelopes (PLAN, "API"):
 *
 * - success: `{ "success": true, "data": <payload> }`
 * - failure: `{ "success": false, "error": { errorId, errorCode, message, details? } }`
 *
 * Two successes are not JSON and so carry no envelope: the `POST /chat` text
 * stream and the `GET /receipts/:key` image bytes. Their failures are enveloped.
 */

/** The closed set of `errorCode`s. A code is part of the contract: rename one and the client breaks. */
export const errorCodes = [
  "UNAUTHORIZED",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "EXPENSE_NOT_FOUND",
  "UNKNOWN_CATEGORY",
  "EXPENSE_DISCARDED",
  "EXPENSE_CONFIRMED",
  "RECEIPT_NOT_FOUND",
  "INVALID_RECEIPT",
  "MODEL_UNREACHABLE",
  "TOO_MANY_REQUESTS",
  "INTERNAL_ERROR",
] as const

export type ErrorCode = (typeof errorCodes)[number]

export const ErrorCode = Schema.Literals(errorCodes)

/** The HTTP status each code is sent with: the one place it is decided. */
export const errorCatalog: { readonly [Code in ErrorCode]: number } = {
  /** The bearer token is missing or wrong. Sent for every path but health, known or not. */
  UNAUTHORIZED: 401,
  /** The params, query or body did not match the endpoint's schema. `details.issues` names each field. */
  VALIDATION_FAILED: 400,
  /** No route has this method and path. */
  NOT_FOUND: 404,
  /** No Expense the route can act on has this id. `details.id`. */
  EXPENSE_NOT_FOUND: 404,
  /** The Category id is not one of the seeded set (ADR-0004). `details.categoryId`. */
  UNKNOWN_CATEGORY: 400,
  /** A discarded Expense cannot be confirmed. `details.id`. */
  EXPENSE_DISCARDED: 409,
  /** A confirmed Expense cannot be discarded; delete it instead. `details.id`. */
  EXPENSE_CONFIRMED: 409,
  /** No stored Receipt has this key. `details.receiptKey`. */
  RECEIPT_NOT_FOUND: 404,
  /** The upload is not one image of an accepted type and size; `message` says which. */
  INVALID_RECEIPT: 400,
  /** The model could not be reached before it wrote anything. `details.reason`. */
  MODEL_UNREACHABLE: 503,
  /** The model provider is rate limiting us (it answered 429). Sending again later retries. */
  TOO_MANY_REQUESTS: 429,
  /** Anything unexpected. The body says nothing more; the log has the cause under the errorId. */
  INTERNAL_ERROR: 500,
}

/** The `error` object of a failure envelope. */
export const ApiErrorBody = Schema.Struct({
  /** Random per response (a UUID) and logged with it, so a user can quote it and it can be found. */
  errorId: Schema.String,
  errorCode: ErrorCode,
  /** For a human. Not stable: match on `errorCode`. */
  message: Schema.String,
  /** Structured context, e.g. the field that failed validation or the id not found. */
  details: Schema.optional(Schema.Unknown),
})
export type ApiErrorBody = typeof ApiErrorBody.Type

/** Any failure, as sent on the wire. */
export const ApiFailure = Schema.Struct({
  success: Schema.Literal(false),
  error: ApiErrorBody,
})
export type ApiFailure = typeof ApiFailure.Type

/** A success as sent on the wire, `data` being the endpoint's payload: for a client that reads JSON itself. */
export const ApiSuccess = <S extends Schema.Top>(data: S) =>
  Schema.Struct({ success: Schema.Literal(true), data })
export interface ApiSuccess<A> {
  readonly success: true
  readonly data: A
}

/** What a JSON endpoint answers, as sent on the wire. Discriminate on `success`. */
export type ApiResponse<A> = ApiSuccess<A> | ApiFailure

/** `{ success: true, data }` to the payload, whatever it is; `ok` then decodes `data`. */
const unwrapData = Schema.Struct({ success: Schema.Literal(true), data: Schema.Unknown }).pipe(
  Schema.decodeTo(
    Schema.Unknown,
    SchemaTransformation.transform({
      decode: (envelope) => envelope.data,
      encode: (data) => ({ success: true as const, data }),
    }),
  ),
)

/**
 * An endpoint's success schema: `{ success: true, data }` on the wire, the
 * payload itself to the handler and to an `HttpApiClient`, so neither
 * handles the envelope.
 */
export const ok = <S extends Schema.Top>(data: S) => unwrapData.pipe(Schema.decodeTo(data))

/** A success with nothing to say, `{ success: true, data: null }`: the handler returns `null`. */
export const okNull = ok(Schema.Null)

// The Web Crypto global, present in Workers, browsers and Node; the contract compiles without DOM types.
declare const crypto: { randomUUID(): string }

/** A random error id (a UUID). Every error class defaults its `errorId` to one. */
export const makeErrorId = (): string => crypto.randomUUID()

/** The field every API error class carries, filled on construction. */
export const errorIdField = {
  errorId: Schema.String.pipe(Schema.withConstructorDefault(Effect.sync(makeErrorId))),
}

/** What an API error class must be for `apiError` to send it. */
interface ErrorClass extends Schema.Top {
  readonly identifier: string
  readonly Encoded: { readonly _tag: string; readonly errorId: string }
}

/** Fields the envelope carries itself, so they are not repeated in `details`. */
const envelopeKeys = new Set(["_tag", "errorId", "message"])

const notThisError = (input: unknown, message: string) =>
  new SchemaIssue.InvalidValue({ message }, input)

/**
 * The wire form of an API error class, for an endpoint's `error`: the
 * class's fields become `details`, apart from `_tag`, `errorId` and a
 * `message` field, and the status is the code's in `errorCatalog`. Decoding
 * checks `errorCode`, so a client tells apart two errors sharing a status.
 */
export const apiError = <C extends ErrorClass>(
  error: C,
  code: ErrorCode,
  message: (fields: C["Encoded"]) => string,
) => {
  const isFields = Schema.is(Schema.toEncoded(error))
  const flatten = SchemaTransformation.transformEffect<unknown, ApiFailure>({
    decode: (failure) =>
      failure.error.errorCode === code
        ? Effect.succeed({
            ...(typeof failure.error.details === "object" ? failure.error.details : {}),
            _tag: error.identifier,
            errorId: failure.error.errorId,
            message: failure.error.message,
          })
        : Effect.fail(notThisError(failure, `Expected errorCode ${code}`)),
    encode: (fields) => {
      if (!isFields(fields))
        return Effect.fail(notThisError(fields, `Expected ${error.identifier}`))
      const details = Object.fromEntries(
        Object.entries(fields).filter(([key]) => !envelopeKeys.has(key)),
      )
      return Effect.succeed({
        success: false as const,
        error: {
          errorId: fields.errorId,
          errorCode: code,
          message: message(fields),
          ...(Object.keys(details).length > 0 ? { details } : {}),
        },
      })
    },
  })
  return ApiFailure.pipe(
    Schema.decodeTo(Schema.Unknown, flatten),
    Schema.decodeTo(error),
    HttpApiSchema.status(errorCatalog[code]),
  )
}
