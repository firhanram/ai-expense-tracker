import { env } from "cloudflare:workers"
import { applyD1Migrations } from "cloudflare:test"

// Setup file: brings the test D1 to the same schema Alchemy applies in dev and
// on deploy. Idempotent, so it is safe to run before every test file.
if (env.TEST_MIGRATIONS === undefined) {
  throw new Error("TEST_MIGRATIONS is not bound; see vitest.config.ts")
}
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
