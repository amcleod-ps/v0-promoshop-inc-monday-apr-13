import { isTieredPricingEnabled } from "@/lib/pricing/feature"
import { normalizeUnitPriceUsd } from "@/lib/pricing/money"
import type {
  PriceTier,
  PricingTierMap,
  SnapshotProduct,
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

interface PricingProductRow {
  sku: unknown
  name: unknown
  min_qty: unknown
  is_active: unknown
}

type AdminClient = ReturnType<typeof createAdminClient>

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
 * Both release gates, checked together against one client.
 *
 * The environment variable is the deploy-time gate and the database flag is
 * the runtime one; either being off means no pricing exists as far as the rest
 * of the application is concerned. Returning "unavailable" separately from
 * "closed" matters at submission time: a closed gate is the normal quiet
 * state, while an unavailable database is a fault the caller must not paper
 * over by treating everything as unpriced.
 */
async function pricingGatesOpen(
  supabase: AdminClient,
): Promise<"open" | "closed" | "unavailable"> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "tiered_pricing")
    .maybeSingle()

  if (error) return "unavailable"

  const flag = data as FeatureFlagRow | null
  return flag?.enabled === true ? "open" : "closed"
}

function parseTierRows(
  rows: readonly PriceTierRow[],
  requested: ReadonlySet<string>,
): PricingTierMap | null {
  const tierMap: Record<string, PriceTier[]> = Object.create(null)

  for (const row of rows) {
    if (
      typeof row.product_sku !== "string" ||
      !requested.has(row.product_sku) ||
      typeof row.tier_start_quantity !== "number" ||
      !Number.isSafeInteger(row.tier_start_quantity) ||
      row.tier_start_quantity <= 0 ||
      (typeof row.unit_price_usd !== "string" &&
        typeof row.unit_price_usd !== "number")
    ) {
      return null
    }

    const unitPriceUsd = normalizeUnitPriceUsd(String(row.unit_price_usd))
    if (unitPriceUsd === null) return null

    const tiers = (tierMap[row.product_sku] ??= [])
    const previous = tiers.at(-1)

    if (previous && row.tier_start_quantity <= previous.tierStartQuantity) {
      return null
    }

    tiers.push({
      tierStartQuantity: row.tier_start_quantity,
      unitPriceUsd,
    })
  }

  return tierMap
}

async function readTiers(
  supabase: AdminClient,
  requestedSkus: readonly string[],
): Promise<PricingTierMap | null> {
  const { data, error } = await supabase
    .from("product_price_tiers")
    .select("product_sku, tier_start_quantity, unit_price_usd")
    .in("product_sku", requestedSkus as string[])
    .order("product_sku", { ascending: true })
    .order("tier_start_quantity", { ascending: true })

  if (error || !Array.isArray(data)) return null

  return parseTierRows(data as PriceTierRow[], new Set(requestedSkus))
}

/**
 * Reads pricing separately from the product catalogue so a disabled feature
 * or missing 0012 migration cannot collapse existing catalogue routes.
 *
 * The server-only service-role client is used because browser roles have no
 * pricing-table privileges.
 *
 * - {} means either gate is closed, no SKUs were requested, or no rows exist.
 * - null means client initialization, query, or row validation failed.
 */
export async function getPriceTiersBySku(
  skus: readonly string[],
): Promise<PricingTierMap | null> {
  if (!isTieredPricingEnabled()) return {}

  const requestedSkus = requestedSkuList(skus)
  if (requestedSkus.length === 0) return {}

  let supabase: AdminClient

  try {
    supabase = createAdminClient()
  } catch {
    return null
  }

  const gates = await pricingGatesOpen(supabase)
  if (gates === "unavailable") return null
  if (gates === "closed") return {}

  return readTiers(supabase, requestedSkus)
}

export type QuotePricingContext =
  | { readonly status: "disabled" }
  | { readonly status: "unavailable" }
  | {
      readonly status: "ready"
      readonly products: ReadonlyMap<string, SnapshotProduct>
      readonly tiers: PricingTierMap
    }

/**
 * Loads everything the server needs to price a submitted quote for itself:
 * the catalogue facts and the current tiers, both read here rather than taken
 * from the browser.
 *
 * Inactive products are returned rather than filtered out. The catalogue
 * routes only ever show active products, but a SKU can be retired while a cart
 * sits open, and the difference between "we retired this" and "we have never
 * heard of this SKU" is exactly what a reviewer needs to see on the request.
 */
export async function loadQuotePricingContext(
  skus: readonly string[],
): Promise<QuotePricingContext> {
  if (!isTieredPricingEnabled()) return { status: "disabled" }

  const requestedSkus = requestedSkuList(skus)
  if (requestedSkus.length === 0) return { status: "disabled" }

  let supabase: AdminClient

  try {
    supabase = createAdminClient()
  } catch {
    return { status: "unavailable" }
  }

  const gates = await pricingGatesOpen(supabase)
  if (gates === "unavailable") return { status: "unavailable" }
  if (gates === "closed") return { status: "disabled" }

  const { data, error } = await supabase
    .from("products")
    .select("sku, name, min_qty, is_active")
    .in("sku", requestedSkus)

  if (error || !Array.isArray(data)) return { status: "unavailable" }

  const products = new Map<string, SnapshotProduct>()

  for (const row of data as PricingProductRow[]) {
    if (
      typeof row.sku !== "string" ||
      typeof row.name !== "string" ||
      typeof row.min_qty !== "number" ||
      !Number.isSafeInteger(row.min_qty) ||
      row.min_qty <= 0 ||
      typeof row.is_active !== "boolean"
    ) {
      return { status: "unavailable" }
    }

    products.set(row.sku, {
      sku: row.sku,
      name: row.name,
      minimumQuantity: row.min_qty,
      isActive: row.is_active,
    })
  }

  const tiers = await readTiers(supabase, requestedSkus)
  if (tiers === null) return { status: "unavailable" }

  return { status: "ready", products, tiers }
}
