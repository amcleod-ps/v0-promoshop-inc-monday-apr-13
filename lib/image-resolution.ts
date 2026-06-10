/**
 * Squarespace CDN resolution hints.
 *
 * Seeded product images live on images.squarespace-cdn.com, where the
 * `format=NNNNw` query parameter controls the served width. Many seeds carry
 * a low hint (`format=500w`) chosen for thumbnails; rendered in the detail
 * modal or full-screen lightbox (or on a 2x display) those 500px files are
 * upscaled and look soft. This helper raises the hint to the smallest
 * Squarespace-cached size that covers the rendered width.
 *
 * Non-Squarespace URLs (Supabase Storage uploads, /public assets) pass
 * through untouched — they have no resize parameter and always serve the
 * original bytes. Existing query params (`?v=<updated_at>` cache-busting)
 * are preserved; the hint is never lowered below what the URL already asks
 * for, so an explicitly seeded 2500w stays 2500w everywhere.
 */

// The width variants Squarespace pre-caches. Requests for other values fall
// back unpredictably, so always snap to one of these.
const SQUARESPACE_WIDTHS = [100, 300, 500, 750, 1000, 1500, 2500]

export function withMinImageWidth(url: string, minWidthPx: number): string {
  if (!url || !url.includes("squarespace-cdn.com")) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (parsed.hostname !== "images.squarespace-cdn.com") return url

  const target =
    SQUARESPACE_WIDTHS.find((w) => w >= minWidthPx) ??
    SQUARESPACE_WIDTHS[SQUARESPACE_WIDTHS.length - 1]

  const current = parsed.searchParams.get("format")
  const currentWidth = current ? Number.parseInt(current, 10) : NaN
  // Never downgrade an explicit higher hint.
  if (Number.isFinite(currentWidth) && currentWidth >= target) return url

  parsed.searchParams.set("format", `${target}w`)
  return parsed.toString()
}
