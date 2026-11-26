/**
 * An assistant reply as the Chat stores it: the prose for the bubble and,
 * separately, the raw OpenUI Lang program, if the reply wrote one.
 */
export interface SplitReply {
  readonly content: string
  readonly uiText: string | null
}

const fenceLine = /^\s*```\s*([\w-]*)\s*$/
/** Fence tags that hold OpenUI Lang. An untagged fence counts: the parser reads those too. */
const programTags = new Set(["", "openui-lang", "openui"])
const statementLine = /^\s*[A-Za-z_$][\w$]*\s*=\s*\S/
const rootLine = /^\s*root\s*=/

const joinProse = (segments: ReadonlyArray<string>) =>
  segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("\n\n")

/** Fenced blocks as program, everything outside them as prose. A fence left open runs to the end. */
const splitFenced = (lines: ReadonlyArray<string>) => {
  const prose: Array<string> = []
  const program: Array<string> = []
  let current: Array<string> = []
  let fence: { readonly tag: string; readonly opening: string; body: Array<string> } | null = null
  for (const line of lines) {
    const match = fenceLine.exec(line)
    if (fence === null) {
      if (match === null) {
        current.push(line)
        continue
      }
      prose.push(current.join("\n"))
      current = []
      fence = { tag: match[1] ?? "", opening: line, body: [] }
    } else if (match === null || match[1] !== "") {
      fence.body.push(line)
    } else {
      if (programTags.has(fence.tag)) program.push(fence.body.join("\n"))
      else prose.push([fence.opening, ...fence.body, line].join("\n"))
      fence = null
    }
  }
  if (fence !== null) {
    if (programTags.has(fence.tag)) program.push(fence.body.join("\n"))
    else prose.push([fence.opening, ...fence.body].join("\n"))
  }
  prose.push(current.join("\n"))
  return { prose, program }
}

/** A program the model forgot to fence: the lines from its first statement to its last, if one is `root`. */
const splitUnfenced = (lines: ReadonlyArray<string>): SplitReply | null => {
  const first = lines.findIndex((line) => statementLine.test(line))
  const last = lines.findLastIndex((line) => statementLine.test(line))
  if (first === -1) return null
  const block = lines.slice(first, last + 1)
  if (!block.some((line) => rootLine.test(line))) return null
  return {
    content: joinProse([lines.slice(0, first).join("\n"), lines.slice(last + 1).join("\n")]),
    uiText: block.join("\n").trim(),
  }
}

/**
 * The program with one `root`: the last, which is the one the parser reads
 * (a later definition of a name replaces an earlier one). A statement runs
 * from its `name =` line to the next, so a root written over several lines
 * goes whole.
 */
const isRoot = (statement: ReadonlyArray<string>) => rootLine.test(statement[0] ?? "")

const lastRootOnly = (program: string) => {
  const statements: Array<Array<string>> = []
  for (const line of program.split("\n")) {
    const current = statements.at(-1)
    if (current === undefined || statementLine.test(line)) statements.push([line])
    else current.push(line)
  }
  const last = statements.findLastIndex(isRoot)
  return statements
    .filter((statement, index) => index === last || !isRoot(statement))
    .flat()
    .join("\n")
}

/**
 * Splits the model's whole reply into prose (`content`) and program
 * (`ui_text`). Statements from several fenced blocks join into one program
 * with one `root`, the last, as the parser reads them; prose segments join
 * with a blank line, so prose that came after a program still reads after
 * the prose that came before it.
 */
export const splitReply = (text: string): SplitReply => {
  const lines = text.split(/\r?\n/)
  const { prose, program } = splitFenced(lines)
  const statements = program.map((body) => body.trim()).filter((body) => body.length > 0)
  const split =
    statements.length > 0
      ? { content: joinProse(prose), uiText: statements.join("\n") }
      : splitUnfenced(lines)
  if (split === null) return { content: joinProse(prose), uiText: null }
  return {
    content: split.content,
    uiText: split.uiText === null ? null : lastRootOnly(split.uiText),
  }
}

const rootStack = /^\s*root\s*=\s*Stack\(\s*\[(.*)\]\s*\)\s*$/

/**
 * A fenced block that adds one component, `name = expression`, to the
 * reply's program: it redefines `root` as the reply's own `Stack` with
 * `name` appended, so the parser, live or on reload, reads one tree that
 * shows both. With no program, or a root it cannot read on one line, the
 * component becomes the whole program.
 */
export const extendProgram = (reply: string, name: string, expression: string) => {
  const root = splitReply(reply)
    .uiText?.split("\n")
    .find((line) => rootLine.test(line))
  const children = root === undefined ? "" : (rootStack.exec(root)?.[1]?.trim() ?? "")
  return [
    "```openui-lang",
    `root = Stack([${children === "" ? name : `${children}, ${name}`}])`,
    `${name} = ${expression}`,
    "```",
  ].join("\n")
}

/** The inverse of `splitReply`, for showing the model its own earlier reply. */
export const joinReply = ({ content, uiText }: SplitReply) =>
  uiText === null ? content : joinProse([content, `\`\`\`openui-lang\n${uiText}\n\`\`\``])
