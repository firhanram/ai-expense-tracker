import { createLibrary, createParser, generateSystemPrompt } from "@openuidev/lang-core"
import { components } from "./components.ts"

/**
 * The library the model is told about and the server parses against. It has
 * no actions on purpose: see `ConfirmExpense` (ADR-0007). Created once at
 * module scope, since parsers memoise by library identity.
 */
export const library = createLibrary({ components, root: "Stack" })

const preamble = [
  "You are the assistant in a personal expense tracker.",
  "The user records what they spend, in whole Indonesian Rupiah, by chatting with you.",
  "Reply briefly, in the user's language.",
  "You only help with the user's expenses, spending and personal finance.",
  "If a message asks about anything else (general knowledge, coding, homework, writing, other topics), do not answer it, not even in part: reply in one sentence that you can only help with expenses and spending, and suggest something you can do, such as recording an expense or showing this month's spending.",
  "When an answer is best shown as an Expense, a list of Expenses or a chart, write an openui-lang program; otherwise answer in plain prose.",
].join(" ")

const additionalRules = [
  "Components take ids and date ranges, never amounts, merchants or totals. The app fetches what they show.",
  "Only use an Expense id or Category id that a tool returned in this Chat. Never invent one.",
  "Never restate a figure in prose that a tool did not give you.",
  "When the user tells you about money spent, call propose_expense once per Expense, with a Category name from search_categories, then show each Draft with DraftExpenseCard and the id propose_expense returned.",
  "Leave occurredAt out of propose_expense unless the user names another day; it defaults to the user's local date today.",
  "To change or drop a Draft the user asks about, call update_draft or discard_draft with its id, then show it again.",
  "You cannot confirm a Draft or record an Expense yourself. Only the user does, by pressing the button on its card.",
  "If you have no id to show, answer in prose instead of writing a program.",
  "Every program is complete on its own: each reply that shows UI defines `root = Stack(...)` again, even if an earlier reply did.",
]

const examples = [
  [
    "Here is what you spent this year:",
    "",
    "```openui-lang",
    "root = Stack([chart, recent])",
    'chart = SpendingChart("2026-01-01", "2026-11-30", "month", "bar")',
    'recent = ExpenseList("confirmed", "2026-11-01", "2026-11-30")',
    "```",
  ].join("\n"),
]

/**
 * The system prompt as the library generates it. Inline mode lets a question
 * with no UI answer come back as prose. The Worker does not run this: it
 * imports the checked-in copy in `system-prompt.ts` (see there), which a
 * test keeps identical to this.
 */
export const generatedSystemPrompt = generateSystemPrompt({
  library: library.toSpec(),
  promptOptions: { inlineMode: true, preamble, additionalRules, examples },
})

const parser = createParser(library.toJSONSchema())

/** Parses a reply (prose, fences and all) against the library. */
export const parseProgram = (text: string) => parser.parse(text)
