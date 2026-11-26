import type { Locator, Page } from "@playwright/test"
import { fileURLToPath } from "node:url"

/** The design's frame sizes (docs/design/design.pen). */
export const viewports = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const

export type ViewportName = keyof typeof viewports
export type Theme = "light" | "dark"

export const themes: ReadonlyArray<Theme> = ["light", "dark"]

/** Sizes the page to a design frame and switches `prefers-color-scheme`. */
export const showAs = async (page: Page, viewport: ViewportName, theme: Theme) => {
  await page.setViewportSize(viewports[viewport])
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" })
}

const screenshotsDir = fileURLToPath(new URL("../screenshots/", import.meta.url))

/**
 * Saves `target` (the page, or one element) to `e2e/screenshots/<ticket>/<name>.png`,
 * committed so it can be compared with the design PNGs. It records; it does not assert.
 */
export const screenshot = async (target: Page | Locator, ticket: string, name: string) => {
  const path = `${screenshotsDir}${ticket}/${name}.png`
  await target.screenshot({ path, animations: "disabled" })
}
