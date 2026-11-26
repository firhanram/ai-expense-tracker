import { describe, expect, it } from "vitest"
import { fitWithin } from "./downscale.ts"

describe("fitWithin", () => {
  it("scales a tall photo so its height is the long edge", () => {
    expect(fitWithin(3024, 4032, 1280)).toEqual({ width: 960, height: 1280 })
  })

  it("scales a wide photo so its width is the long edge", () => {
    expect(fitWithin(4000, 1000, 1280)).toEqual({ width: 1280, height: 320 })
  })

  it("never enlarges a small photo", () => {
    expect(fitWithin(600, 800, 1280)).toEqual({ width: 600, height: 800 })
  })
})
