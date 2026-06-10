"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SiteImageMap } from "@/lib/supabase/images"

const SiteImagesContext = createContext<SiteImageMap>({})

export function SiteImagesProvider({
  value,
  children,
}: {
  value: SiteImageMap
  children: ReactNode
}) {
  return (
    <SiteImagesContext.Provider value={value}>
      {children}
    </SiteImagesContext.Provider>
  )
}

/**
 * Returns the resolved URL for `key`, with `?v=<updated_at>` cache-busting
 * applied when a Supabase row exists. Returns `fallback` when no row is
 * found or the row has an empty URL.
 */
export function useSiteImageUrl(key: string, fallback: string): string {
  const map = useContext(SiteImagesContext)
  const row = map[key]
  if (row?.url) {
    return `${row.url}?v=${encodeURIComponent(row.updatedAt)}`
  }
  return fallback
}

/**
 * Returns the admin-edited alt text for `key`, or null when no row exists
 * or its alt text is empty (callers keep their hard-coded alt).
 */
export function useSiteImageAlt(key: string): string | null {
  const map = useContext(SiteImagesContext)
  return map[key]?.altText || null
}
