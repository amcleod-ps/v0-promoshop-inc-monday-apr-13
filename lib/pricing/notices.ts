import { resolveSiteText } from "@/lib/site-text"
import {
  APPROXIMATE_PRICING_COPY,
  CANADIAN_PRICING_COPY,
  LARGE_QUANTITY_COPY,
  missingPricingKind,
  NO_PRICING_COPY,
} from "./presentation"

/**
 * Admin-editable public pricing notices. They ride the existing Text content
 * mechanism: each notice is a `site_content` key registered in
 * lib/cms/text-slots.ts (so the dashboard's Text tab offers it under
 * "Pricing notices" and saves through `updateSiteContent`), and the public
 * components read it through `usePricingNotices()`. The compiled-in copy in
 * presentation.ts stays the default. Values render as plain React text —
 * never through the rich-text renderer — so markup shows exactly as typed.
 */
export interface PricingNotices {
  approximate: string
  canadian: string
  noPricing: string
  largeQuantity: string
}

export interface PricingNoticeSlot {
  notice: keyof PricingNotices
  key: string
  label: string
  fallback: string
}

export const PRICING_NOTICE_SLOTS: readonly PricingNoticeSlot[] = [
  {
    notice: "approximate",
    key: "pricing.notice.approximate",
    label: "Estimate notice (shown below prices)",
    fallback: APPROXIMATE_PRICING_COPY,
  },
  {
    notice: "canadian",
    key: "pricing.notice.canadian",
    label: "Canadian pricing notice (products that wait for Canadian prices)",
    fallback: CANADIAN_PRICING_COPY,
  },
  {
    notice: "noPricing",
    key: "pricing.notice.no_pricing",
    label: "No-price notice (products without a price)",
    fallback: NO_PRICING_COPY,
  },
  {
    notice: "largeQuantity",
    key: "pricing.notice.large_quantity",
    label: "Large quantity notice (48 or more units)",
    fallback: LARGE_QUANTITY_COPY,
  },
]

/**
 * Resolves every notice against a `site_content` map. A saved value wins
 * only when it has visible text; empty or whitespace-only values show the
 * default, so a cleared field can never blank a pricing disclaimer.
 */
export function resolvePricingNotices(
  map: Record<string, { value: string } | undefined>,
): PricingNotices {
  const notices = {} as PricingNotices
  for (const slot of PRICING_NOTICE_SLOTS) {
    const value = resolveSiteText(map, slot.key, slot.fallback)
    notices[slot.notice] = value.trim() ? value : slot.fallback
  }
  return notices
}

export function missingPricingNotice(
  notices: PricingNotices,
  sku: string,
): string {
  return missingPricingKind(sku) === "canadian"
    ? notices.canadian
    : notices.noPricing
}
