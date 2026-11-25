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
 * Splits the model's whole reply into prose (`content`) and program
 * (`ui_text`). Statements from several fenced blocks join into one program;
 * prose segments join with a blank line, so prose that came after a program
 * still reads after the prose that came before it.
 */
export const splitReply = (text: string): SplitReply => {
  const lines = text.split(/\r?\n/)
  const { prose, program } = splitFenced(lines)
  const statements = program.map((body) => body.trim()).filter((body) => body.length > 0)
  if (statements.length > 0) return { content: joinProse(prose), uiText: statements.join("\n") }
  return splitUnfenced(lines) ?? { content: joinProse(prose), uiText: null }
}

/** The inverse of `splitReply`, for showing the model its own earlier reply. */
export const joinReply = ({ content, uiText }: SplitReply) =>
  uiText === null ? content : joinProse([content, `\`\`\`openui-lang\n${uiText}\n\`\`\``])
