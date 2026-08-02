import "server-only"

import type { createAdminClient } from "@/lib/supabase/admin"
import { normalizeUnitPriceUsd } from "@/lib/pricing/money"
import type {
  PricingAdminProduct,
  PricingAuditEntry,
  PricingPanelState,
} from "@/lib/pricing/admin-types"

type AdminClient = ReturnType<typeof createAdminClient>

interface ProductRow {
  sku: string
  name: string
  min_qty: number
}

interface TierRow {
  product_sku: string
  tier_start_quantity: number
  unit_price_usd: string | number
}

interface StateRow {
  product_sku: string
  revision: string | number
  status: "active" | "retired"
  fingerprint: string
  updated_at: string
}

interface AuditRow {
  id: string
  change_id: string
  product_sku: string
  action: "replace" | "retire"
  previous_revision: string | number
  revision: string | number
  previous_tier_count: number
  tier_count: number
  actor: string
  reason: string | null
  source_fingerprint: string
  changed_at: string
}

function migrationMissing(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(
      error?.message?.includes("does not exist") ||
        error?.message?.includes("schema cache") ||
        error?.message?.includes("Could not find the table"),
    )
  )
}

/**
 * Loads administrative price data independently of the public release gates.
 * The caller must establish strict pricing-admin access before invoking this
 * function. It returns only serializable, browser-safe fields.
 */
export async function loadPricingAdminPanel(
  supabase: AdminClient,
): Promise<PricingPanelState> {
  const [productsResult, tiersResult, stateResult, auditResult, flagResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("sku, name, min_qty")
        .eq("is_active", true)
        .order("sku", { ascending: true }),
      supabase
        .from("product_price_tiers")
        .select("product_sku, tier_start_quantity, unit_price_usd")
        .order("product_sku", { ascending: true })
        .order("tier_start_quantity", { ascending: true }),
      supabase
        .from("product_price_tier_sets")
        .select("product_sku, revision, status, fingerprint, updated_at")
        .order("product_sku", { ascending: true }),
      supabase
        .from("product_price_tier_audit")
        .select(
          "id, change_id, product_sku, action, previous_revision, revision, previous_tier_count, tier_count, actor, reason, source_fingerprint, changed_at",
        )
        .order("changed_at", { ascending: false })
        .limit(50),
      supabase
        .from("feature_flags")
        .select("enabled")
        .eq("key", "tiered_pricing")
        .maybeSingle(),
    ])

  if (migrationMissing(stateResult.error) || migrationMissing(auditResult.error)) {
    return { kind: "migration_missing" }
  }

  const errors = [
    productsResult.error,
    tiersResult.error,
    stateResult.error,
    auditResult.error,
    flagResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    for (const error of errors) {
      console.error("[pricing-admin] data load failed", error)
    }
    return { kind: "error" }
  }

  const states = new Map(
    ((stateResult.data ?? []) as StateRow[]).map((state) => [
      state.product_sku,
      state,
    ]),
  )
  const tiersBySku = new Map<string, TierRow[]>()
  for (const tier of (tiersResult.data ?? []) as TierRow[]) {
    const list = tiersBySku.get(tier.product_sku) ?? []
    list.push(tier)
    tiersBySku.set(tier.product_sku, list)
  }

  const products: PricingAdminProduct[] = (
    (productsResult.data ?? []) as ProductRow[]
  ).map((product) => {
    const state = states.get(product.sku)
    return {
      sku: product.sku,
      name: product.name,
      minimumQuantity: product.min_qty,
      revision: state ? String(state.revision) : "0",
      status: state?.status ?? "never_configured",
      fingerprint: state?.fingerprint ?? null,
      updatedAt: state?.updated_at ?? null,
      tiers: (tiersBySku.get(product.sku) ?? []).map((tier) => ({
        tierStartQuantity: tier.tier_start_quantity,
        unitPriceUsd:
          normalizeUnitPriceUsd(String(tier.unit_price_usd)) ??
          String(tier.unit_price_usd),
      })),
    }
  })

  const recentAudit: PricingAuditEntry[] = (
    (auditResult.data ?? []) as AuditRow[]
  ).map((entry) => ({
    id: entry.id,
    changeId: entry.change_id,
    productSku: entry.product_sku,
    action: entry.action,
    previousRevision: String(entry.previous_revision),
    revision: String(entry.revision),
    previousTierCount: entry.previous_tier_count,
    tierCount: entry.tier_count,
    actor: entry.actor,
    reason: entry.reason,
    sourceFingerprint: entry.source_fingerprint,
    changedAt: entry.changed_at,
  }))

  return {
    kind: "ready",
    dbFlagEnabled: flagResult.data?.enabled === true,
    serverFlagEnabled: process.env.TIERED_PRICING_ENABLED === "true",
    products,
    recentAudit,
  }
}
