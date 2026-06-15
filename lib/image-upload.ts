import "server-only"

import { MAX_IMAGE_BYTES } from "./upload-limits"

/**
 * Hardened validation for admin image uploads.
 *
 * The public `site-images` bucket serves whatever is uploaded straight from
 * the site's own origin, so an SVG (or any file with an executable payload)
 * stored there becomes stored XSS. The client-supplied MIME type (`file.type`)
 * and filename are attacker-controlled, so we do NOT trust them: we sniff the
 * file's magic bytes, accept only a small allowlist of raster formats, and
 * derive the stored file extension + Content-Type from the sniffed type —
 * never from the upload's `type`/`name`.
 */

export { MAX_IMAGE_BYTES }

// Sniffed MIME type -> safe file extension used for the stored object.
const RASTER_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const

type RasterType = keyof typeof RASTER_TYPES

export type ImageValidation =
  | { ok: true; buffer: ArrayBuffer; contentType: RasterType; ext: string }
  | { ok: false; error: string }

/**
 * Inspects the leading bytes of the buffer and returns the matching raster
 * MIME type, or null if it isn't one of the allowed formats. SVG, HTML, and
 * anything text-based fail every signature check and are rejected.
 */
function sniffRasterType(buffer: ArrayBuffer): RasterType | null {
  const b = new Uint8Array(buffer)
  if (b.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png"
  }

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"

  // GIF: "GIF8" (87a / 89a)
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return "image/gif"
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp"
  }

  // AVIF: ISO-BMFF "ftyp" box at offset 4 with an "avif"/"avis" brand in
  // major_brand (bytes 8-11) OR the compatible_brands list (bytes 16+). Many
  // real-world AVIFs carry major_brand "mif1"/"msf1" and list "avif" only as a
  // compatible brand, so checking the major brand alone rejects valid files.
  // The ftyp box-type guard is unchanged, so non-AVIF containers (mp4/mov with
  // isom/mp42) still won't match.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const isAvifBrand = (off: number) => {
      const brand = String.fromCharCode(b[off], b[off + 1], b[off + 2], b[off + 3])
      return brand === "avif" || brand === "avis"
    }
    if (isAvifBrand(8)) return "image/avif" // major_brand
    // Box size is bytes 0-3 big-endian; bound the compatible_brands scan by it
    // (and by the buffer length) so we never read past the ftyp box.
    const boxSize = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0
    const end = Math.min(boxSize > 0 ? boxSize : b.length, b.length)
    for (let off = 16; off + 4 <= end; off += 4) {
      if (isAvifBrand(off)) return "image/avif" // compatible_brands
    }
  }

  return null
}

/**
 * Validates an uploaded image and returns its bytes plus a safe content-type
 * and extension derived from the file's actual contents. Callers should upload
 * with the returned `contentType` and build the storage path with `ext`,
 * ignoring the original filename and `file.type` entirely.
 */
export async function validateImageUpload(file: unknown): Promise<ImageValidation> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please pick a file before uploading." }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    }
  }

  const buffer = await file.arrayBuffer()
  const contentType = sniffRasterType(buffer)
  if (!contentType) {
    return {
      ok: false,
      error:
        "Unsupported image. Allowed formats: PNG, JPEG, WebP, GIF, AVIF. (SVG and other file types are blocked for security.)",
    }
  }

  return { ok: true, buffer, contentType, ext: RASTER_TYPES[contentType] }
}
