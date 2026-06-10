/**
 * Per-image display-mode ("fit") overrides.
 *
 * Some CMS-managed images render inside fixed-aspect frames (hero slides,
 * the About hero, brand lifestyle backdrops) where the code historically
 * hard-coded `object-cover`. Cover crops the image to fill the frame, which
 * butchers logos and tall/wide artwork — so the dashboard now offers a
 * "Fill the frame" vs "Show the whole image" choice per placement.
 *
 * The choice is stored as a `site_content` row (no schema change, live on
 * the production DB immediately) under the key `image-fit.<slot>`, where
 * `<slot>` is the placement's stable id:
 *   - `hero_slide.<row id>`        — homepage slideshow slides
 *   - any `site_images` key        — e.g. `about.hero`, `brand.<slug>.lifestyle`
 *
 * Values are sanitized on read: anything other than "contain" renders as
 * the historical default, "cover". Pure module — safe on server and client.
 */

export type ImageFit = "cover" | "contain"

export const IMAGE_FIT_PREFIX = "image-fit."

export function imageFitKey(slot: string): string {
  return `${IMAGE_FIT_PREFIX}${slot}`
}

/** Table-Editor edits bypass the dashboard's validation — never trust the stored value. */
export function normalizeImageFit(value: string | null | undefined): ImageFit {
  return value === "contain" ? "contain" : "cover"
}

export function imageFitClass(fit: ImageFit): string {
  return fit === "contain" ? "object-contain" : "object-cover"
}
