// Worker bindings. Alchemy declares the real resources; this is their type.
declare namespace Cloudflare {
  interface Env {
    readonly DB: D1Database
    /** Bearer token every API route but health requires. A secret, never in source. */
    readonly API_TOKEN: string
  }
}
