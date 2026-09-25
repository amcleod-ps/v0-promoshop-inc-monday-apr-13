"use client"

import { useMemo } from "react"
import { useSiteContentMap } from "@/components/site-content-provider"
import { resolvePricingNotices, type PricingNotices } from "@/lib/pricing/notices"

/**
 * The live pricing notices: admin text from `site_content` (Text content →
 * Pricing notices) with the compiled-in copy as the default. Must be called
 * inside the layout's <SiteContentProvider>.
 */
export function usePricingNotices(): PricingNotices {
  const map = useSiteContentMap()
  return useMemo(() => resolvePricingNotices(map), [map])
}
