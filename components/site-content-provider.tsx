"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { SiteContentMap } from "@/lib/supabase/content"

const SiteContentContext = createContext<SiteContentMap>({})

/**
 * Resolves `key` against `map` exactly like `useSiteText`, but without
 * touching React internals — safe to call inside loops, hooks, or non-
 * component code. Returns the override value when set and non-empty,
 * else the fallback.
 */
export function resolveSiteText(
  map: SiteContentMap,
  key: string,
  fallback: string,
): string {
  const row = map[key]
  if (row && row.value && row.value.length > 0) return row.value
  return fallback
}

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
