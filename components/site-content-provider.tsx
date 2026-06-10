"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SiteContentMap } from "@/lib/supabase/content"
import { resolveSiteText } from "@/lib/site-text"

const SiteContentContext = createContext<SiteContentMap>({})

// Single shared resolver (the server path in lib/supabase/content.ts
// re-exports the same definition) — safe to call inside loops, hooks, or
// non-component code.
export { resolveSiteText }

export function useSiteContentMap(): SiteContentMap {
  return useContext(SiteContentContext)
}

export function SiteContentProvider({
  value,
  children,
}: {
  value: SiteContentMap
  children: ReactNode
}) {
  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  )
}

/**
 * Returns the admin-overridden text for `key` when one is set and
 * non-empty, otherwise `fallback`. Safe to call from any client component
 * inside the layout's <SiteContentProvider>.
 */
export function useSiteText(key: string, fallback: string): string {
  const map = useContext(SiteContentContext)
  return resolveSiteText(map, key, fallback)
}
