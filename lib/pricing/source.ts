export type ProductPricingSource = "CAN" | "USA"
export type PricingCurrency = "CAD" | "USD"
export type PricingTotals = Partial<Record<PricingCurrency, string>>

/**
 * Canadian price rows in the approved September 30 pricing workbook.
 * These amounts were entered through the legacy USD-named tier fields.
 * Their values stay unchanged. This list gives those values their currency;
 * changing an availability tag must never change the meaning of a price.
 */
export const CANADIAN_PRICE_SKUS = [
  "BAG 109", "BAG 110", "SWE 105", "TUM 103", "TUM 104",
  "BAG 129", "TUM 105", "TUM 106", "TUM 107",
] as const

/** U.S. source rows in the same approved workbook, independent of availability. */
export const AMERICAN_PRICE_SKUS = [
  "ACC 002", "BAG 117", "BAG 118", "ACC 003", "ACC 004", "BAG 119",
  "BAG 120", "PUL 001", "TOP 100", "TANK 001", "PUL 002", "TOP 101",
  "TOP 102", "SWE 101", "TUM 101", "TUM 100", "BAG 101", "BAG 102",
  "BAG 103", "BAG 104", "BAG 105", "BAG 106", "BAG 107", "BAG 108",
  "TOP 104", "VEST 002", "PUL 003", "SWE 104", "HAT 001", "HAT 002",
  "HAT 003", "PUL 004", "PUL 005", "PUL 006", "SWE 106", "TOP 107",
  "TOP 108", "PUL 007", "SWE 107", "BAG 111", "BAG 112", "HAT 004",
  "TOP 109", "BAG 113", "JAK 001", "VEST 003", "VEST 004", "PUL 008",
  "BAG 114", "BAG 115", "HAT 005", "ACC 001", "TOP 110", "TOP 111",
  "SWE 108", "HAT 006", "HAT 007", "BAG 116", "PUL 009", "SWE 110",
  "BAG 122", "SWE 111", "TOP 114", "PUL 010", "TOP 115", "TOP 116",
  "SWE 113", "TUM 108", "TUM 109", "TUM 110", "TUM 111", "BAG 123",
  "BAG 124", "BAG 125", "BAG 126", "BAG 127", "SWE 114", "PUL 013",
  "PUL 014", "PUL 015", "TOP 117", "VEST 005", "TOP 118", "BAG 128",
  "VEST 006", "TOP 119", "TOP 120", "ACC 005", "ACC 006", "BAG 130",
] as const

function normalizedSku(sku: string): string {
  return sku.trim().toUpperCase().replace(/\s+/g, " ")
}

const canadianPriceSkus = new Set<string>(CANADIAN_PRICE_SKUS)
const americanPriceSkus = new Set<string>(AMERICAN_PRICE_SKUS)

export function productPriceCurrency(sku: string): PricingCurrency {
  return canadianPriceSkus.has(normalizedSku(sku)) ? "CAD" : "USD"
}

/** Availability tags are not evidence of the supplier's country. */
export function productPricingSource(product: {
  sku: string
  tags?: readonly string[]
}): ProductPricingSource | null {
  const sku = normalizedSku(product.sku)
  if (canadianPriceSkus.has(sku)) return "CAN"
  if (americanPriceSkus.has(sku)) return "USA"
  return null
}

export function pricingTotalEntries(totals: PricingTotals): Array<[PricingCurrency, string]> {
  return (["CAD", "USD"] as const).flatMap((currency) =>
    typeof totals[currency] === "string" ? [[currency, totals[currency]] as [PricingCurrency, string]] : [],
  )
}

/**
 * True when a product is priced in U.S. dollars: it is on the approved U.S.
 * source list, or the site has price tiers for it that display in USD. The
 * Canadian site hides these products so Canadian visitors only browse items
 * priced in CAD (or not priced yet). Items with no price stay visible.
 */
export function hasUsdPricing(
  product: { sku: string },
  tiersBySku?: Readonly<Record<string, readonly unknown[] | undefined>>,
): boolean {
  if (productPriceCurrency(product.sku) !== "USD") return false
  if (americanPriceSkus.has(normalizedSku(product.sku))) return true
  return (tiersBySku?.[product.sku]?.length ?? 0) > 0
}

/** Products a visitor may browse on the given country site. */
export function productsForLocale<T extends { sku: string }>(
  products: readonly T[],
  locale: "CAN" | "USA",
  tiersBySku?: Readonly<Record<string, readonly unknown[] | undefined>>,
): T[] {
  if (locale !== "CAN") return [...products]
  return products.filter((product) => !hasUsdPricing(product, tiersBySku))
}
