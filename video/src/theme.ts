import { loadFont as loadInter } from "@remotion/google-fonts/Inter"
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono"

// The canvas (docs/design/design.pen) uses Inter and JetBrains Mono as
// stand-ins for the app's system stacks, so the video does the same.
export const sans = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
}).fontFamily

export const mono = loadMono("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
}).fontFamily

// Light-theme tokens from DESIGN.md.
export const c = {
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  surface2: "#F5F5F4",
  line: "#E7E5E4",
  text: "#1C1917",
  muted: "#78716C",
  accent: "#1C1917",
  accentFg: "#FAFAF9",
  ring: "#57534E",
  danger: "#B91C1C",
  warnBg: "#FEF3C7",
  warnFg: "#92400E",
  online: "#16A34A",
  chart: ["#1C1917", "#44403C", "#78716C", "#A8A29E", "#D6D3D1"],
}

export const shadowXs = "0 1px 2px rgba(28,25,23,0.06)"
export const windowShadow = "0 1px 2px rgba(28,25,23,0.04), 0 24px 64px -16px rgba(28,25,23,0.18)"

export const rupiah = (n: number) =>
  (n < 0 ? "-" : "") + "Rp" + new Intl.NumberFormat("id-ID").format(Math.abs(Math.round(n)))
