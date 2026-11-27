/**
 * The Worker's check of a redrawn program (`POST /chat/:messageId/rerender`),
 * without OpenUI or Zod, which cannot load in the Worker (see
 * `system-prompt.ts`). It reads the program the way the library's parser
 * does for the shapes this library has, and refuses what the parser would
 * drop or the client could not draw; `redraw.test.ts` holds it to
 * `checkProgram` on the failure modes. It also refuses an id the original
 * reply did not have, since a redraw must not invent one (ADR-0001).
 */

/** Each component's positional arguments: how many, and which one is an id. */
export const componentSignatures = {
  DraftExpenseCard: { min: 1, max: 1, ids: { 0: "string" } },
  ExpenseCard: { min: 1, max: 1, ids: { 0: "string" } },
  ExpenseList: { min: 1, max: 4, ids: { 3: "number" } },
  SpendingChart: { min: 4, max: 4, ids: {} },
} as const satisfies Record<
  string,
  { min: number; max: number; ids: Readonly<Record<number, "string" | "number">> }
>

type ComponentName = keyof typeof componentSignatures

const isComponent = (name: string): name is ComponentName =>
  Object.hasOwn(componentSignatures, name)

type Expr =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "literal" }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "call"; readonly name: string; readonly args: ReadonlyArray<Expr> }
  | { readonly kind: "array"; readonly items: ReadonlyArray<Expr> }

const token = /\s*(?:("(?:[^"\\\n]|\\.)*")|(-?\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|([()[\],=])|(\S))/y

const tokenize = (line: string): Array<string> => {
  const tokens: Array<string> = []
  token.lastIndex = 0
  while (token.lastIndex < line.length) {
    const match = token.exec(line)
    if (match === null) break
    if (match[5] !== undefined) throw new Error(`unexpected "${match[5]}"`)
    const value = match[1] ?? match[2] ?? match[3] ?? match[4]
    if (value !== undefined) tokens.push(value)
  }
  return tokens
}

const peek = (tokens: ReadonlyArray<string>): string | undefined => tokens[0]

const parseExpr = (tokens: Array<string>): Expr => {
  const next = tokens.shift()
  if (next === undefined) throw new Error("the program is incomplete")
  if (next.startsWith('"')) return { kind: "string", value: JSON.parse(next) as string }
  if (/^-?\d/.test(next)) return { kind: "number", value: Number(next) }
  if (next === "[") {
    const items: Array<Expr> = []
    while (peek(tokens) !== "]") {
      items.push(parseExpr(tokens))
      if (peek(tokens) === ",") tokens.shift()
      else if (peek(tokens) !== "]") throw new Error("the program is incomplete")
    }
    tokens.shift()
    return { kind: "array", items }
  }
  if (!/^[A-Za-z_$]/.test(next)) throw new Error(`unexpected "${next}"`)
  if (next === "true" || next === "false" || next === "null") return { kind: "literal" }
  if (peek(tokens) !== "(") return { kind: "ref", name: next }
  tokens.shift()
  const args: Array<Expr> = []
  while (peek(tokens) !== ")") {
    args.push(parseExpr(tokens))
    if (peek(tokens) === ",") tokens.shift()
    else if (peek(tokens) !== ")") throw new Error("the program is incomplete")
  }
  tokens.shift()
  return { kind: "call", name: next, args }
}

const parseStatements = (program: string) => {
  const statements = new Map<string, Expr>()
  for (const line of program.split("\n")) {
    if (line.trim() === "") continue
    const tokens = tokenize(line)
    const name = tokens.shift()
    if (name === undefined || tokens.shift() !== "=") throw new Error(`not a statement: ${line}`)
    statements.set(name, parseExpr(tokens))
    if (tokens.length > 0) throw new Error(`unexpected "${peek(tokens)}"`)
  }
  return statements
}

/** What is wrong with `program` as a redraw of `original`; empty when it draws. */
export const checkRedraw = (program: string, original: string): ReadonlyArray<string> => {
  let statements: Map<string, Expr>
  try {
    statements = parseStatements(program)
  } catch (error) {
    return [error instanceof Error ? error.message : "the program does not parse"]
  }
  const root = statements.get("root")
  if (root?.kind !== "call" || root.name !== "Stack" || root.args.length !== 1)
    return ["no root: the program needs root = Stack([...])"]
  const [children] = root.args
  if (children?.kind !== "array" || children.items.length === 0) return ["nothing to draw"]

  const problems: Array<string> = []
  const component = (expr: Expr, seen: ReadonlySet<string>): void => {
    if (expr.kind === "ref") {
      const defined = statements.get(expr.name)
      if (defined === undefined) return void problems.push(`unresolved reference: ${expr.name}`)
      if (seen.has(expr.name)) return void problems.push(`circular reference: ${expr.name}`)
      return component(defined, new Set([...seen, expr.name]))
    }
    if (expr.kind !== "call" || !isComponent(expr.name))
      return void problems.push(`not a component Stack can hold`)
    const signature = componentSignatures[expr.name]
    if (expr.args.length < signature.min || expr.args.length > signature.max)
      return void problems.push(`${expr.name} takes ${signature.min}–${signature.max} arguments`)
    for (const [index, type] of Object.entries(signature.ids)) {
      const arg = expr.args[Number(index)]
      if (arg === undefined) continue
      if (arg.kind !== type) return void problems.push(`${expr.name} needs a ${type} id`)
      const written = arg.kind === "string" ? JSON.stringify(arg.value) : String(arg.value)
      const inOriginal =
        arg.kind === "string"
          ? original.includes(written)
          : new RegExp(`(?<![\\w.-])${written}(?![\\w.])`).test(original)
      if (!inOriginal) problems.push(`invented id: ${written}`)
    }
  }
  for (const child of children.items) component(child, new Set())
  return problems
}
