import type { Locale } from "@/lib/cms/locale"
import { resolveSiteText } from "@/lib/site-text"
import {
  APPROXIMATE_PRICING_COPY,
  CANADA_CANADIAN_PRICING_COPY,
  CANADA_USA_PRICING_COPY,
  LARGE_QUANTITY_COPY,
  NO_PRICING_COPY,
  USA_CANADIAN_PRICING_COPY,
  USA_USA_PRICING_COPY,
} from "./presentation"

/** Public notices use the Text content controls and render as plain text. */
export interface PricingNotices {
  canadaCanadian: string
  canadaUsa: string
  usaCanadian: string
  usaUsa: string
  noPricing: string
  largeQuantity: string
  approximate: string
}

export interface PricingNoticeSlot {
  notice: Exclude<keyof PricingNotices, "approximate">
  key: string
  label: string
  fallback: string
  legacyKey?: string
}

export const PRICING_NOTICE_SLOTS: readonly PricingNoticeSlot[] = [
  {
    notice: "canadaCanadian",
    key: "pricing.notice.canada_canadian",
    label: "Canada site (.ca): products sourced from Canada",
    fallback: CANADA_CANADIAN_PRICING_COPY,
  },
  {
    notice: "canadaUsa",
    key: "pricing.notice.canada_usa",
    label: "Canada site (.ca): products sourced from USA",
    fallback: CANADA_USA_PRICING_COPY,
  },
  {
    notice: "usaCanadian",
    key: "pricing.notice.usa_canadian",
    label: "USA site (.com): products sourced from Canada",
    fallback: USA_CANADIAN_PRICING_COPY,
  },
  {
    notice: "usaUsa",
    key: "pricing.notice.usa_usa",
    label: "USA site (.com): products sourced from USA",
    fallback: USA_USA_PRICING_COPY,
    legacyKey: "pricing.notice.approximate",
  },
  {
    notice: "noPricing",
    key: "pricing.notice.no_pricing",
    label: "Both sites: products without a price",
    fallback: NO_PRICING_COPY,
  },
  {
    notice: "largeQuantity",
    key: "pricing.notice.large_quantity",
    label: "Both sites: orders of 48 units or more",
    fallback: LARGE_QUANTITY_COPY,
  },
]

/** A cleared field restores its default. Old estimate text remains available. */
export function resolvePricingNotices(
  map: Record<string, { value: string } | undefined>,
): PricingNotices {
  const notices = { approximate: APPROXIMATE_PRICING_COPY } as PricingNotices
  for (const slot of PRICING_NOTICE_SLOTS) {
    const key = !map[slot.key] && slot.legacyKey ? slot.legacyKey : slot.key
    const value = resolveSiteText(map, key, slot.fallback)
    notices[slot.notice] = value.trim() ? value : slot.fallback
  }
  return notices
}

/** The site country and product source select the notice independently. */
export function productPricingNotice(
  notices: PricingNotices,
  siteLocale: Locale,
  productSource: Locale | null,
): string {
  if (!productSource) return notices.approximate
  if (siteLocale === "CAN") {
    return productSource === "CAN" ? notices.canadaCanadian : notices.canadaUsa
  }
  return productSource === "CAN" ? notices.usaCanadian : notices.usaUsa
}

/** Every product without a price uses the same notice on both sites. */
export function missingPricingNotice(notices: PricingNotices): string {
  return notices.noPricing
}
