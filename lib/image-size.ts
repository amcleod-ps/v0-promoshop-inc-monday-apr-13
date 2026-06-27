/**
 * Per-image display-size overrides.
 *
 * Complements lib/image-fit.ts: where "fit" controls cropping inside a fixed
 * frame, "size" lets the team scale a free-standing image up or down without
 * touching code. Today it drives the site logo in the header and footer — the
 * single most-requested "can we make it bigger/smaller" control — and the
 * helper is shaped so more placements can opt in later.
 *
 * The choice is stored as a `site_content` row (no schema change, live on the
 * production DB immediately) under the key `image-size.<slot>`, where `<slot>`
 * is the placement's stable id — a `site_images` key such as `site.logo`.
 *
 * Values are sanitized on read: anything other than "sm"/"lg" renders at the
 * historical default, "md". Pure module — safe on server and client.
 */

export type ImageSize = "sm" | "md" | "lg"

export const IMAGE_SIZE_PREFIX = "image-size."

export function imageSizeKey(slot: string): string {
  return `${IMAGE_SIZE_PREFIX}${slot}`
}

/** Table-Editor edits bypass the dashboard's validation — never trust the stored value. */
export function normalizeImageSize(value: string | null | undefined): ImageSize {
  return value === "sm" || value === "lg" ? value : "md"
}

/**
 * Maps a sanitized size to one of three caller-supplied values. The caller
 * owns the actual classes because the "default" size differs by placement
 * (the header logo is taller than the footer logo); this just routes the
 * choice to the matching slot.
 */
export function pickBySize<T>(size: ImageSize, choices: { sm: T; md: T; lg: T }): T {
  return choices[size]
}
