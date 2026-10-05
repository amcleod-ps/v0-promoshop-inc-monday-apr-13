"use client"

import { useMemo } from "react"
import { useSiteContentMap } from "@/components/site-content-provider"
import { resolvePricingNotices, type PricingNotices } from "@/lib/pricing/notices"

/**
 * Read the four regional notices and two shared notices from Text content.
 * Saved text overrides the defaults inside the layout's SiteContentProvider.
 */
export function usePricingNotices(): PricingNotices {
  const map = useSiteContentMap()
  return useMemo(() => resolvePricingNotices(map), [map])
}
