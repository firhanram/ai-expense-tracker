import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

// The same directory Alchemy applies in `alchemy dev` and on deploy.
const migrations = await readD1Migrations(new URL("./migrations", import.meta.url).pathname)

export default defineConfig({
  test: {
    projects: [
      {
        // The Worker, in workerd against a local D1.
        plugins: [
          cloudflareTest({
            main: "./src/index.ts",
            miniflare: {
              compatibilityDate: "2026-11-20",
              compatibilityFlags: ["nodejs_compat"],
              d1Databases: ["DB"],
              r2Buckets: ["RECEIPTS"],
              bindings: { API_TOKEN: "test-api-token", TEST_MIGRATIONS: migrations },
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["src/**/*.test.ts"],
          setupFiles: ["./src/testing/applyMigrations.ts"],
        },
      },
      {
        // Scripts that run in Node, such as the OpenUI eval.
        test: { name: "scripts", include: ["scripts/**/*.test.ts"], environment: "node" },
      },
    ],
  },
})
