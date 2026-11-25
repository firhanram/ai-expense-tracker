// Worker bindings. Alchemy declares the real resources; this is their type.
declare namespace Cloudflare {
  interface Env {
    readonly DB: D1Database
  }
}
