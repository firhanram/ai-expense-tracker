import { ReceiptContentTypes } from "@expense/contract"

/**
 * The longest side sent to the model. DeepSeek reads an image as at most
 * 1,024 tokens whatever its size (PLAN, "Receipts"), about a megapixel, so
 * more pixels only cost upload time.
 */
export const receiptLongEdge = 1280

const quality = 0.85

/** The types a Receipt may be, for the picker's `accept`. */
export const receiptTypes: ReadonlyArray<string> = ReceiptContentTypes

/** `width × height` scaled down, never up, so the longer side is at most `longEdge`. */
export const fitWithin = (
  width: number,
  height: number,
  longEdge: number,
): { readonly width: number; readonly height: number } => {
  const scale = Math.min(1, longEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** The photo could not be decoded as an image. */
export class UnreadableImage extends Error {
  override readonly name = "UnreadableImage"
}

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))

const jpegName = (name: string) => `${name.replace(/\.[^.]*$/, "") || "receipt"}.jpg`

/**
 * The photo at most `receiptLongEdge` on its long side, re-encoded as JPEG
 * on white (a transparent PNG would otherwise turn black). A photo already
 * small enough that is no larger than its JPEG goes as it is. Without
 * `createImageBitmap` the photo goes unchanged; the server still checks it.
 */
export const downscaleReceipt = async (file: File): Promise<File> => {
  if (typeof createImageBitmap !== "function") return file
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new UnreadableImage(`Couldn't decode ${file.name}`)
  })
  try {
    const size = fitWithin(bitmap.width, bitmap.height, receiptLongEdge)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (context === null) return file
    context.fillStyle = "#fff"
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    const jpeg = await toJpeg(canvas)
    if (jpeg === null) return file
    const shrunk = size.width < bitmap.width || size.height < bitmap.height
    if (!shrunk && jpeg.size >= file.size) return file
    return new File([jpeg], jpegName(file.name), { type: "image/jpeg" })
  } finally {
    bitmap.close()
  }
}
