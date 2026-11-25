import { Context } from "effect"

/**
 * What the model is told before the Chat. A reference with a prose-only
 * default, so #11 can provide the prompt generated from the component
 * library (`Layer.succeed(SystemPrompt, generated)`) without touching the turn.
 * It must not vary per request: a stable prefix is what prompt caching keys on.
 */
export const SystemPrompt = Context.Reference<string>("expense/SystemPrompt", {
  defaultValue: () =>
    [
      "You are the assistant in a personal expense tracker.",
      "The user records what they spend, in whole Indonesian Rupiah, by chatting with you.",
      "Reply briefly, in plain prose, in the user's language.",
      "You cannot record, change or look up expenses yet; say so if asked.",
    ].join(" "),
})
