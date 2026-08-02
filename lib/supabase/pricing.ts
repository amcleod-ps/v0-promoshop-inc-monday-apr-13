import { isTieredPricingEnabled } from "@/lib/pricing/feature"
import { normalizeUnitPriceUsd } from "@/lib/pricing/money"
import type {
  PriceTier,
  PricingTierMap,
} from "@/lib/pricing/types"
import { createAdminClient } from "./admin"

interface FeatureFlagRow {
  enabled: unknown
}

interface PriceTierRow {
  product_sku: unknown
  tier_start_quantity: unknown
  unit_price_usd: unknown
}

function requestedSkuList(skus: readonly string[]): string[] {
  const unique = new Set<string>()

  for (const rawSku of skus) {
    if (typeof rawSku !== "string") continue

    const sku = rawSku.trim()
    if (sku) unique.add(sku)
  }

  return [...unique]
}

/**
 * Reads pricing separately from the product catalogue so a disabled feature
 * or missing 0012 migration cannot collapse existing catalogue routes.
 *
 * The server-only service-role client is used because browser roles have no
 * pricing-table privileges. It queries tiers only after both independent
 * release gates pass:
 *
 * - {} means either gate is disabled, no SKUs were requested, or no rows exist.
 * - null means client initialization, query, or row validation failed.
 */
export async function getPriceTiersBySku(
  skus: readonly string[],
): Promise<PricingTierMap | null> {
  if (!isTieredPricingEnabled()) return {}

  const requestedSkus = requestedSkuList(skus)
  if (requestedSkus.length === 0) return {}

  let supabase: ReturnType<typeof createAdminClient>

  try {
    supabase = createAdminClient()
  } catch {
    return null
  }

  const { data: rawFeatureFlag, error: featureFlagError } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "tiered_pricing")
    .maybeSingle()

  if (featureFlagError) return null

  const featureFlag = rawFeatureFlag as FeatureFlagRow | null
  if (!featureFlag || featureFlag.enabled !== true) return {}

  const { data, error } = await supabase
    .from("product_price_tiers")
    .select("product_sku, tier_start_quantity, unit_price_usd")
    .in("product_sku", requestedSkus)
    .order("product_sku", { ascending: true })
    .order("tier_start_quantity", { ascending: true })

  if (error || !Array.isArray(data)) return null

  const requested = new Set(requestedSkus)
  const tierMap: Record<string, PriceTier[]> = Object.create(null)

  for (const rawRow of data as PriceTierRow[]) {
    if (
      typeof rawRow.product_sku !== "string" ||
      !requested.has(rawRow.product_sku) ||
      typeof rawRow.tier_start_quantity !== "number" ||
      !Number.isSafeInteger(rawRow.tier_start_quantity) ||
      rawRow.tier_start_quantity <= 0 ||
      (typeof rawRow.unit_price_usd !== "string" &&
        typeof rawRow.unit_price_usd !== "number")
    ) {
      return null
    }

    const unitPriceUsd = normalizeUnitPriceUsd(
      String(rawRow.unit_price_usd),
    )
    if (unitPriceUsd === null) return null

    const tiers = (tierMap[rawRow.product_sku] ??= [])
    const previous = tiers.at(-1)

    if (
      previous &&
      rawRow.tier_start_quantity <= previous.tierStartQuantity
    ) {
      return null
    }

    tiers.push({
      tierStartQuantity: rawRow.tier_start_quantity,
      unitPriceUsd,
    })
  }

  return tierMap
}
