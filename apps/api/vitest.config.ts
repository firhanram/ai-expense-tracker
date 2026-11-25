import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      miniflare: {
        compatibilityDate: "2026-11-20",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        bindings: { API_TOKEN: "test-api-token" },
      },
    }),
  ],
})
