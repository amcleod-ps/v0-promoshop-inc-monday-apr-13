import "server-only"

import type { createAdminClient } from "@/lib/supabase/admin"
import { normalizeUnitPriceUsd } from "@/lib/pricing/money"
import type {
  PricingAdminProduct,
  PricingAuditEntry,
  PricingPanelState,
} from "@/lib/pricing/admin-types"

type AdminClient = ReturnType<typeof createAdminClient>

const REVISION_PATTERN = /^[1-9][0-9]{0,15}$/
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/
const MAX_INT4 = 2_147_483_647
const MAX_SKU_LENGTH = 5_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function migrationMissing(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    Boolean(
      error?.message?.includes("does not exist") ||
        error?.message?.includes("schema cache") ||
        error?.message?.includes("Could not find the table") ||
        error?.message?.includes("Could not find the function"),
    )
  )
}

function rejectedSnapshot(reason: string): PricingPanelState {
  console.error("[pricing-admin] coherent snapshot rejected", reason)
  return { kind: "error" }
}

/**
 * Loads the whole editable pricing surface through one scalar database RPC.
 * The SQL function aggregates products, tiers, revisions, integrity evidence,
 * audit and the release flag from one statement snapshot, avoiding both REST
 * row caps and torn reads. The caller must establish strict pricing-admin
 * access before invoking this function.
 */
export async function loadPricingAdminPanel(
  supabase: AdminClient,
): Promise<PricingPanelState> {
  const { data, error } = await supabase.rpc("load_pricing_admin_snapshot")

  if (migrationMissing(error)) return { kind: "migration_missing" }
  if (error) {
    console.error("[pricing-admin] coherent snapshot load failed", error)
    return { kind: "error" }
  }

  const snapshotValue =
    Array.isArray(data) && data.length === 1 && isRecord(data[0])
      ? data[0]
      : data
  if (!isRecord(snapshotValue)) return rejectedSnapshot("invalid root")
  if (snapshotValue.schema_version !== 1) {
    return rejectedSnapshot("unsupported schema version")
  }
  if (
    !Array.isArray(snapshotValue.products) ||
    !Array.isArray(snapshotValue.tiers) ||
    !Array.isArray(snapshotValue.states) ||
    !Array.isArray(snapshotValue.audit) ||
    typeof snapshotValue.pricing_enabled !== "boolean"
  ) {
    return rejectedSnapshot("invalid collection shape")
  }

  const productsBySku = new Map<
    string,
    {
      sku: string
      name: string
      minimumQuantity: number
      isActive: boolean
    }
  >()
  for (const raw of snapshotValue.products) {
    if (
      !isRecord(raw) ||
      typeof raw.sku !== "string" ||
      !raw.sku ||
      raw.sku !== raw.sku.trim() ||
      raw.sku.length > MAX_SKU_LENGTH ||
      typeof raw.name !== "string" ||
      !Number.isInteger(raw.min_qty) ||
      Number(raw.min_qty) < 1 ||
      Number(raw.min_qty) > MAX_INT4 ||
      typeof raw.is_active !== "boolean" ||
      productsBySku.has(raw.sku)
    ) {
      return rejectedSnapshot("invalid or duplicate product")
    }
    productsBySku.set(raw.sku, {
      sku: raw.sku,
      name: raw.name,
      minimumQuantity: Number(raw.min_qty),
      isActive: raw.is_active,
    })
  }

  const tiersBySku = new Map<
    string,
    Array<{ tierStartQuantity: number; unitPriceUsd: string }>
  >()
  for (const raw of snapshotValue.tiers) {
    if (
      !isRecord(raw) ||
      typeof raw.product_sku !== "string" ||
      !Number.isInteger(raw.tier_start_quantity) ||
      Number(raw.tier_start_quantity) < 1 ||
      Number(raw.tier_start_quantity) > MAX_INT4 ||
      typeof raw.unit_price_usd !== "string"
    ) {
      return rejectedSnapshot("invalid tier")
    }
    const normalized = normalizeUnitPriceUsd(raw.unit_price_usd)
    if (!normalized || normalized !== raw.unit_price_usd) {
      return rejectedSnapshot("noncanonical tier price")
    }
    const tiers = tiersBySku.get(raw.product_sku) ?? []
    tiers.push({
      tierStartQuantity: Number(raw.tier_start_quantity),
      unitPriceUsd: normalized,
    })
    tiersBySku.set(raw.product_sku, tiers)
  }

  const statesBySku = new Map<
    string,
    {
      revision: string
      status: "active" | "retired"
      fingerprint: string
      tierCount: number
      updatedAt: string
    }
  >()
  for (const raw of snapshotValue.states) {
    if (
      !isRecord(raw) ||
      typeof raw.product_sku !== "string" ||
      typeof raw.revision !== "string" ||
      !REVISION_PATTERN.test(raw.revision) ||
      (raw.status !== "active" && raw.status !== "retired") ||
      typeof raw.fingerprint !== "string" ||
      !FINGERPRINT_PATTERN.test(raw.fingerprint) ||
      typeof raw.computed_fingerprint !== "string" ||
      !FINGERPRINT_PATTERN.test(raw.computed_fingerprint) ||
      raw.computed_fingerprint !== raw.fingerprint ||
      !isNonNegativeInteger(raw.tier_count) ||
      !isNonNegativeInteger(raw.actual_tier_count) ||
      raw.tier_count !== raw.actual_tier_count ||
      typeof raw.updated_at !== "string" ||
      statesBySku.has(raw.product_sku)
    ) {
      return rejectedSnapshot("invalid, duplicate or drifted state")
    }

    const product = productsBySku.get(raw.product_sku)
    const tiers = tiersBySku.get(raw.product_sku) ?? []
    if (
      !product ||
      tiers.length !== raw.tier_count ||
      (raw.status === "active" &&
        (tiers.length === 0 ||
          tiers[0].tierStartQuantity !== product.minimumQuantity)) ||
      (raw.status === "retired" && tiers.length !== 0)
    ) {
      return rejectedSnapshot("state lifecycle invariant failed")
    }

    let previousStart = 0
    for (const tier of tiers) {
      if (tier.tierStartQuantity <= previousStart) {
        return rejectedSnapshot("tier ordering invariant failed")
      }
      previousStart = tier.tierStartQuantity
    }

    statesBySku.set(raw.product_sku, {
      revision: raw.revision,
      status: raw.status,
      fingerprint: raw.fingerprint,
      tierCount: raw.tier_count,
      updatedAt: raw.updated_at,
    })
  }

  for (const sku of tiersBySku.keys()) {
    if (statesBySku.get(sku)?.status !== "active") {
      return rejectedSnapshot("tiers lack an active state")
    }
  }

  const recentAudit: PricingAuditEntry[] = []
  for (const raw of snapshotValue.audit) {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      typeof raw.change_id !== "string" ||
      typeof raw.product_sku !== "string" ||
      (raw.action !== "replace" && raw.action !== "retire") ||
      typeof raw.previous_revision !== "string" ||
      !/^(0|[1-9][0-9]{0,15})$/.test(raw.previous_revision) ||
      typeof raw.revision !== "string" ||
      !REVISION_PATTERN.test(raw.revision) ||
      !isNonNegativeInteger(raw.previous_tier_count) ||
      !isNonNegativeInteger(raw.tier_count) ||
      typeof raw.actor !== "string" ||
      (raw.reason !== null && typeof raw.reason !== "string") ||
      typeof raw.source_fingerprint !== "string" ||
      !FINGERPRINT_PATTERN.test(raw.source_fingerprint) ||
      typeof raw.changed_at !== "string"
    ) {
      return rejectedSnapshot("invalid audit entry")
    }
    recentAudit.push({
      id: raw.id,
      changeId: raw.change_id,
      productSku: raw.product_sku,
      action: raw.action,
      previousRevision: raw.previous_revision,
      revision: raw.revision,
      previousTierCount: raw.previous_tier_count,
      tierCount: raw.tier_count,
      actor: raw.actor,
      reason: raw.reason,
      sourceFingerprint: raw.source_fingerprint,
      changedAt: raw.changed_at,
    })
  }

  const products: PricingAdminProduct[] = Array.from(
    productsBySku.values(),
    (product) => {
      const state = statesBySku.get(product.sku)
      return {
        ...product,
        revision: state?.revision ?? "0",
        status: state?.status ?? "never_configured",
        fingerprint: state?.fingerprint ?? null,
        updatedAt: state?.updatedAt ?? null,
        tiers: tiersBySku.get(product.sku) ?? [],
      }
    },
  )

  return {
    kind: "ready",
    dbFlagEnabled: snapshotValue.pricing_enabled,
    serverFlagEnabled: process.env.TIERED_PRICING_ENABLED === "true",
    products,
    recentAudit,
  }
}
