import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Tests run east of UTC so a date helper that reads UTC instead of local time fails.
process.env.TZ = "Asia/Jakarta"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { port: 4173, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/shared/testing/setup.ts"],
  },
})
