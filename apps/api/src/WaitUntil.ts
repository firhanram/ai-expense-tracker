import { Context } from "effect"

/**
 * The Worker's `ctx.waitUntil`, provided per request by `index.ts`. Work
 * handed to it keeps the Worker alive after the response has been sent or
 * the client has gone, e.g. the rest of a Chat turn whose reader left
 * mid-stream. It is optional: outside a Worker there is nothing to extend,
 * and the work simply runs in a detached fiber.
 */
export class WaitUntil extends Context.Service<WaitUntil, (promise: Promise<unknown>) => void>()(
  "expense/WaitUntil",
) {}
