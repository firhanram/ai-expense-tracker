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
              compatibilityDate: "2026-11-02",
              compatibilityFlags: ["nodejs_compat"],
              d1Databases: ["DB"],
              r2Buckets: ["RECEIPTS"],
              bindings: {
                // A stand-in Access team; its keys are served by `src/testing/serveTeamKeys.ts`.
                ACCESS_TEAM_DOMAIN: "test-team.cloudflareaccess.com",
                ACCESS_AUD: "test-access-aud",
                TEST_MIGRATIONS: migrations,
              },
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["src/**/*.test.ts"],
          setupFiles: ["./src/testing/applyMigrations.ts", "./src/testing/serveTeamKeys.ts"],
        },
      },
      {
        // Scripts that run in Node, such as the OpenUI eval.
        test: { name: "scripts", include: ["scripts/**/*.test.ts"], environment: "node" },
      },
    ],
  },
})
