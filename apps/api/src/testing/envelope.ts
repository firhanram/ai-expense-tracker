import { ApiFailure, type ErrorCode, ValidationIssue } from "@expense/contract"
import { Schema } from "effect"
import { expect } from "vitest"

/** A version-4 UUID, as every errorId is. */
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** The body as JSON; a string is a body `callApiWithModel` already read. */
const parse = <A>(response: Response | string): Promise<A> =>
  typeof response === "string" ? Promise.resolve(JSON.parse(response)) : response.json<A>()

/** The `data` of a success envelope, failing the test if the body is not one. */
export const readData = async <A = unknown>(response: Response | string): Promise<A> => {
  const body = await parse<{ readonly success: unknown; readonly data: A }>(response)
  expect(body.success).toBe(true)
  expect(Object.keys(body).toSorted()).toEqual(["data", "success"])
  return body.data
}

/** The `error` of a failure envelope, failing the test if the body is not one. */
export const readError = async (response: Response | string) =>
  Schema.decodeUnknownSync(ApiFailure)(await parse(response)).error

/** Matches an `error` with this code, any errorId and message, and exactly these details. */
export const anError = (errorCode: ErrorCode, details?: unknown) => ({
  errorId: expect.stringMatching(uuidPattern),
  errorCode,
  message: expect.any(String),
  ...(details === undefined ? {} : { details }),
})

const ValidationDetails = Schema.Struct({ issues: Schema.Array(ValidationIssue) })

/** The validation issues of a `VALIDATION_FAILED` error. */
export const readIssues = async (response: Response | string) => {
  const error = await readError(response)
  expect(error.errorCode).toBe("VALIDATION_FAILED")
  return Schema.decodeUnknownSync(ValidationDetails)(error.details).issues
}
