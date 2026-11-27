import { describe, expect, it } from "vitest"
import { formatRupiah } from "./rupiah.ts"

describe("formatRupiah", () => {
  it("writes whole Rupiah with dot thousands and no decimals", () => {
    expect(formatRupiah(15000)).toBe("Rp15.000")
    expect(formatRupiah(2480000)).toBe("Rp2.480.000")
    expect(formatRupiah(0)).toBe("Rp0")
  })

  it("writes a refund with a leading minus sign", () => {
    expect(formatRupiah(-70000)).toBe("−Rp70.000")
  })
})
