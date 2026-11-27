import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Tests run east of UTC so a date helper that reads UTC instead of local time fails.
process.env.TZ = "Asia/Jakarta"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `alchemy dev` runs this dev server (alchemy.run.ts, "WebDev") with
  // `API_ORIGIN` set to the local Worker, so `/api/*` reaches the real API.
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: process.env.API_ORIGIN ?? "http://localhost:1337", changeOrigin: true },
    },
  },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/shared/testing/setup.ts"],
  },
})
