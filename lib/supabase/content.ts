import { cache } from "react"
import { createClient } from "./server"

export interface SiteContentRow {
  key: string
  label: string
  value: string
  updatedAt: string
}

export type SiteContentMap = Record<string, SiteContentRow>

/**
 * Fetches every editable text row from `site_content` keyed by its stable
 * string key. Components that render text via `useSiteText(key, fallback)`
 * or `resolveSiteText(map, key, fallback)` pick up changes the next time
 * this map is fetched (the root layout uses `force-dynamic`, so that's
 * "on every request").
 *
 * Returns `{}` when the table doesn't exist yet (migrations not applied)
 * or the query errors, so callers can still render their fallbacks.
 */
// React cache(): the layout AND several pages fetch this on the same
// request — dedupe per request without touching the freshness contract.
export const getSiteContentMap = cache(async (): Promise<SiteContentMap> => {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    // Same defensive pattern as getSiteImagesMap: missing env vars must not
    // crash the layout. Components rendering text via useSiteText keep
    // their static fallbacks.
    return {}
  }
  const { data, error } = await supabase
    .from("site_content")
    .select("key, label, value, updated_at")

  if (error || !data) return {}

  const map: SiteContentMap = {}
  for (const row of data) {
    map[row.key] = {
      key: row.key,
      label: row.label,
      value: row.value,
      updatedAt: row.updated_at,
    }
  }
  return map
})

// Single shared resolver (also re-exported by the client provider) — two
// drifting copies previously risked server- and client-rendered text
// disagreeing on the same key.
export { resolveSiteText } from "@/lib/site-text"
