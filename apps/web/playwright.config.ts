import { defineConfig, devices } from "@playwright/test"

// E2E_PORT lets parallel worktrees run their suites side by side.
const port = Number(process.env["E2E_PORT"] ?? 4173)

// Runs against the built bundle served by `vite preview`, never a dev server.
// The API is mocked per test with `mockApi` (e2e/support/api.ts).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    timezoneId: "Asia/Jakarta",
    locale: "id-ID",
  },
  webServer: {
    command: `pnpm build && pnpm preview --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    env: { VITE_API_TOKEN: "e2e-token" },
    timeout: 120_000,
  },
})
