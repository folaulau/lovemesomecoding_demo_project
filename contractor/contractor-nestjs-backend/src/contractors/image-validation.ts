/**
 * Deciding what an uploaded file actually is.
 *
 * ⚠️ `file.mimetype` is NOT evidence. It is the `Content-Type` the CLIENT wrote in the multipart
 * part header, so it is whatever the uploader felt like typing — `curl -F "file=@shell.php;type=image/png"`
 * sets it to `image/png` and costs nothing. The same goes for the filename's extension.
 *
 * The only thing that says what a file is, is the file. Every real image format starts with a
 * fixed byte sequence (a "magic number"), and checking it takes twelve bytes.
 *
 * This is not a complete defence on its own — it is one of three, and all three are applied in
 * `ContractorsService.addPortfolioImage`:
 *   1. the bytes must match one of the formats below,
 *   2. the stored filename is GENERATED, never taken from `file.originalname`,
 *   3. the uploads directory is served as static files with no execution.
 */

export type AllowedImageType = 'image/jpeg' | 'image/png' | 'image/webp'

interface Signature {
  type: AllowedImageType
  extension: string
  /** Byte values that must match, `null` meaning "anything" at that position. */
  magic: Array<number | null>
  offset: number
}

const SIGNATURES: Signature[] = [
  // JPEG: FF D8 FF
  { type: 'image/jpeg', extension: 'jpg', magic: [0xff, 0xd8, 0xff], offset: 0 },
  // PNG: 89 "PNG" CR LF SUB LF — the CR LF and SUB are there so that a transfer which mangles
  // line endings, or a `type` on DOS, corrupts the header visibly rather than silently.
  {
    type: 'image/png',
    extension: 'png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
  },
  // WebP is a RIFF container: "RIFF" ???? "WEBP". The four bytes in between are the file length,
  // which is why the signature has to allow gaps rather than being one contiguous run.
  {
    type: 'image/webp',
    extension: 'webp',
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
    offset: 0,
  },
]

export interface SniffResult {
  type: AllowedImageType
  extension: string
}

/** Returns what the bytes say the file is, or null if they say nothing this app accepts. */
export function sniffImageType(buffer: Buffer): SniffResult | null {
  for (const signature of SIGNATURES) {
    const end = signature.offset + signature.magic.length
    if (buffer.length < end) continue

    const matches = signature.magic.every((byte, index) => {
      if (byte === null) return true
      return buffer[signature.offset + index] === byte
    })

    if (matches) return { type: signature.type, extension: signature.extension }
  }
  return null
}
