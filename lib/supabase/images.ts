import { createClient } from "./server"

export interface SiteImage {
  key: string
  label: string
  url: string
  altText: string | null
  updatedAt: string
}

export type SiteImageMap = Record<string, SiteImage>

/**
 * Fetches every row from `site_images` and returns them keyed by their
 * stable string key (e.g., "site.logo", "brand.patagonia.logo",
 * "team.phil-duym"). Pages that consume images via <SiteImage imageId="...">
 * pick up changes the next time this map is fetched.
 */
export async function getSiteImagesMap(): Promise<SiteImageMap> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("site_images")
    .select("key, label, url, alt_text, updated_at")

  if (error || !data) return {}

  const map: SiteImageMap = {}
  for (const row of data) {
    map[row.key] = {
      key: row.key,
      label: row.label,
      url: row.url || "",
      altText: row.alt_text,
      updatedAt: row.updated_at,
    }
  }
  return map
}

/**
 * Looks up a key in the map. Returns `${url}?v=${updated_at}` when a row
 * exists with a non-empty URL — the query string busts browser, CDN, and
 * next/image caches whenever the row is updated. Falls back to the static
 * `fallback` argument when no row exists or its URL is empty.
 */
export function resolveSiteImageUrl(
  map: SiteImageMap,
  key: string,
  fallback: string,
): string {
  const row = map[key]
  if (row?.url) {
    return `${row.url}?v=${encodeURIComponent(row.updatedAt)}`
  }
  return fallback
}
