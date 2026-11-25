import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// The same directory Alchemy applies in `alchemy dev` and on deploy.
const migrations = await readD1Migrations(new URL("./migrations", import.meta.url).pathname)

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        compatibilityDate: "2026-11-20",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        bindings: { API_TOKEN: "test-api-token", TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    setupFiles: ["./src/testing/applyMigrations.ts"],
  },
})
