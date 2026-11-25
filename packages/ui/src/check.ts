import { parseProgram } from "./library.ts"

/**
 * How a reply fared against the library. `prose` is a reply with no program,
 * which is an answer, not a failure. The rest are the failure modes the eval
 * counts (ADR-0006): the parser drops an invalid child silently and still
 * returns a root, so a non-null root is not enough to call a program good.
 */
export type ProgramOutcome =
  | "ok"
  | "prose"
  | "no-root"
  | "reference-graph"
  | "type-mismatch"
  | "truncation"

export interface ProgramCheck {
  readonly outcome: ProgramOutcome
  /** What the parser objected to, one line each; empty when `ok` or `prose`. */
  readonly problems: ReadonlyArray<string>
}

export interface CheckOptions {
  /** The model's finish reason. `length` means it hit its output limit, so the program is cut off. */
  readonly finishReason?: string | undefined
}

/** Validates a reply (prose, fences and all) as a program in the library. */
export const checkProgram = (text: string, options: CheckOptions = {}): ProgramCheck => {
  const { root, meta } = parseProgram(text)
  const errors = meta.errors.filter((error) => error.severity !== "warning")
  const problems = [
    ...(meta.incomplete ? ["the program is incomplete"] : []),
    ...(options.finishReason === "length" ? ["the model hit its output limit"] : []),
    ...meta.unresolved.map((name) => `unresolved reference: ${name}`),
    ...meta.orphaned.map((name) => `orphaned statement: ${name}`),
    ...errors.map((error) =>
      [error.code, error.statementId, error.message].filter((part) => part).join(": "),
    ),
  ]
  const outcome = ((): ProgramOutcome => {
    if (meta.statementCount === 0) return "prose"
    if (meta.incomplete || options.finishReason === "length") return "truncation"
    if (root === null || errors.some((error) => error.code === "no-root")) return "no-root"
    if (meta.unresolved.length > 0 || meta.orphaned.length > 0) return "reference-graph"
    if (errors.length > 0) return "type-mismatch"
    return "ok"
  })()
  return { outcome, problems: outcome === "prose" ? [] : problems }
}
