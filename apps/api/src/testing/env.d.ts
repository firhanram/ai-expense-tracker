// Bindings only the test Worker has (see `vitest.config.ts`). The shape is
// `D1Migration` from `cloudflare:test`, spelled out to keep this a script file.
declare namespace Cloudflare {
  interface Env {
    readonly TEST_MIGRATIONS?: ReadonlyArray<{ name: string; queries: string[] }>
  }
}
