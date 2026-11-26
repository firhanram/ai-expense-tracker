import type { Browser } from "@playwright/test"

/**
 * A JPEG photo of a till receipt on a table, drawn in the browser, so the
 * suite carries no binary fixture. `width × height` is the photo's size.
 */
export const drawReceiptPhoto = async (
  browser: Browser,
  size: { readonly width: number; readonly height: number },
): Promise<Buffer> => {
  const page = await browser.newPage()
  try {
    const base64 = await page.evaluate(async ({ width, height }) => {
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const g = canvas.getContext("2d")!
      g.fillStyle = "#8a8378"
      g.fillRect(0, 0, width, height)
      g.translate(width / 2, height / 2)
      g.rotate(-0.06)
      const paperW = width * 0.62
      const paperH = height * 0.86
      g.fillStyle = "#f4f1ea"
      g.fillRect(-paperW / 2, -paperH / 2, paperW, paperH)
      g.fillStyle = "#2b2824"
      const unit = paperW / 22
      g.font = `bold ${unit * 1.6}px monospace`
      g.textAlign = "center"
      g.fillText("INDOMARET", 0, -paperH / 2 + unit * 3)
      g.font = `${unit * 0.8}px monospace`
      g.fillText("JL. KEMANG RAYA 12 JAKARTA", 0, -paperH / 2 + unit * 4.4)
      g.textAlign = "left"
      const items = [
        ["BERAS 5KG", "68.900"],
        ["MINYAK 2L", "38.500"],
        ["TELUR 10", "24.600"],
        ["SUSU UHT", "14.500"],
      ]
      let y = -paperH / 2 + unit * 7
      g.font = `${unit}px monospace`
      for (const [name, price] of items) {
        g.fillText(name ?? "", -paperW / 2 + unit, y)
        g.textAlign = "right"
        g.fillText(price ?? "", paperW / 2 - unit, y)
        g.textAlign = "left"
        y += unit * 1.6
      }
      g.fillRect(-paperW / 2 + unit, y, paperW - unit * 2, unit * 0.08)
      y += unit * 1.8
      g.font = `bold ${unit * 1.2}px monospace`
      g.fillText("TOTAL", -paperW / 2 + unit, y)
      g.textAlign = "right"
      g.fillText("146.500", paperW / 2 - unit, y)
      // Sensor noise, so the JPEG is the size of a real photo rather than a flat drawing.
      const image = g.getImageData(0, 0, width, height)
      for (let i = 0; i < image.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 24
        image.data[i] = (image.data[i] ?? 0) + n
        image.data[i + 1] = (image.data[i + 1] ?? 0) + n
        image.data[i + 2] = (image.data[i + 2] ?? 0) + n
      }
      g.putImageData(image, 0, 0)
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95),
      )
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ""
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    }, size)
    return Buffer.from(base64, "base64")
  } finally {
    await page.close()
  }
}

/** A JPEG's pixel size, from its start-of-frame marker. */
export const jpegSize = (jpeg: Buffer): { readonly width: number; readonly height: number } => {
  let at = 2
  while (at < jpeg.length) {
    const marker = jpeg[at + 1] ?? 0
    const length = jpeg.readUInt16BE(at + 2)
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isFrame) return { height: jpeg.readUInt16BE(at + 5), width: jpeg.readUInt16BE(at + 7) }
    at += 2 + length
  }
  throw new Error("Not a JPEG with a frame header")
}
