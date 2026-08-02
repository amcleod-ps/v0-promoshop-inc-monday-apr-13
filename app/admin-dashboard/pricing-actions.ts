"use server"

import { revalidatePath } from "next/cache"

import { adminActionError } from "@/lib/admin-error"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePricingAdminAction } from "@/lib/pricing/admin-access"
import type {
  PricingActionFailure,
  PricingDryRunResult,
  PricingMutationResult,
} from "@/lib/pricing/admin-types"
import {
  dryRunPricingMatrixCsv,
  sha256Hex,
  validateTierSetDraft,
  type PricingCatalogProduct,
  type TierDraft,
} from "@/lib/pricing/matrix"

const REVISION_PATTERN = /^(0|[1-9]\d{0,15})$/
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function validationFailure(
  error: string,
  diagnostics?: PricingActionFailure["diagnostics"],
): PricingActionFailure {
  return { ok: false, code: "validation", error, diagnostics }
}

async function authorizedClient(): Promise<
  | { ok: true; supabase: ReturnType<typeof createAdminClient> }
  | PricingActionFailure
> {
  const denied = await requirePricingAdminAction()
  if (denied) return denied

  try {
    return { ok: true, supabase: createAdminClient() }
  } catch (error) {
    const masked = adminActionError(
      "Pricing administration is temporarily unavailable.",
      error,
    )
    return { ...masked, code: "server_error" }
  }
}

async function loadCatalogAndRevisions(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<
  | {
      ok: true
      catalog: PricingCatalogProduct[]
      revisions: Record<string, string>
    }
  | PricingActionFailure
> {
  const [productsResult, statesResult] = await Promise.all([
    supabase
      .from("products")
      .select("sku, name, min_qty")
      .eq("is_active", true)
      .order("sku", { ascending: true }),
    supabase
      .from("product_price_tier_sets")
      .select("product_sku, revision"),
  ])

  if (productsResult.error || statesResult.error) {
    const masked = adminActionError(
      "Could not load the current pricing administration state.",
      productsResult.error ?? statesResult.error,
    )
    return { ...masked, code: "server_error" }
  }

  const catalog = (productsResult.data ?? []).map((row) => ({
    sku: String(row.sku),
    name: String(row.name),
    minimumQuantity: Number(row.min_qty),
  }))
  const revisions: Record<string, string> = {}
  for (const row of statesResult.data ?? []) {
    revisions[String(row.product_sku)] = String(row.revision)
  }

  return { ok: true, catalog, revisions }
}

function parseExpectedRevisions(
  value: unknown,
): Record<string, string> | null {
  if (!isRecord(value)) return null
  const result: Record<string, string> = {}
  for (const [sku, revision] of Object.entries(value)) {
    if (
      !sku ||
      sku !== sku.trim() ||
      typeof revision !== "string" ||
      !REVISION_PATTERN.test(revision)
    ) {
      return null
    }
    result[sku] = revision
  }
  return result
}

interface RpcResult {
  reconciliation_fingerprint?: unknown
}

async function runMutation(
  supabase: ReturnType<typeof createAdminClient>,
  operations: Array<{
    sku: string
    expected_revision: string
    action: "replace" | "retire"
    tiers: Array<{
      tier_start_quantity: number
      unit_price_usd: string
    }>
  }>,
  sourceFingerprint: string,
  reason: string,
  successMessage: string,
): Promise<PricingMutationResult> {
  const { data, error } = await supabase.rpc(
    "replace_product_price_tier_sets",
    {
      p_operations: operations,
      p_source_fingerprint: sourceFingerprint,
      p_reason: reason,
    },
  )

  if (error) {
    if (error.code === "40001") {
      return {
        ok: false,
        code: "conflict",
        error:
          "Pricing changed after this page loaded. Refresh and review the newer revision before trying again.",
      }
    }
    if (error.code === "22023") {
      return {
        ok: false,
        code: "validation",
        error:
          "No changes were applied. Review the complete tier set and try again.",
      }
    }

    const masked = adminActionError(
      "The pricing change could not be completed.",
      error,
    )
    return { ...masked, code: "server_error" }
  }

  const payload = (data ?? {}) as RpcResult
  if (
    typeof payload.reconciliation_fingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(payload.reconciliation_fingerprint)
  ) {
    const masked = adminActionError(
      "The pricing change returned an invalid reconciliation result.",
    )
    return { ...masked, code: "server_error" }
  }

  revalidatePath("/admin-dashboard")
  return {
    ok: true,
    message: successMessage,
    reconciliationFingerprint: payload.reconciliation_fingerprint,
  }
}

export async function dryRunPricingCsv(
  input: unknown,
): Promise<PricingDryRunResult> {
  const authorized = await authorizedClient()
  if (!authorized.ok) return authorized

  if (
    !isRecord(input) ||
    typeof input.csvText !== "string"
  ) {
    return validationFailure("Choose a valid CSV file.")
  }

  const loaded = await loadCatalogAndRevisions(authorized.supabase)
  if (!loaded.ok) return loaded

  const dryRun = await dryRunPricingMatrixCsv(input.csvText, loaded.catalog)
  if (!dryRun.ok) {
    return validationFailure(
      "The matrix has validation errors. Nothing was written.",
      dryRun.diagnostics,
    )
  }

  const expectedRevisions: Record<string, string> = {}
  for (const set of dryRun.sets) {
    expectedRevisions[set.sku] = loaded.revisions[set.sku] ?? "0"
  }

  return {
    ok: true,
    fingerprint: dryRun.fingerprint,
    rowCount: dryRun.rowCount,
    skuCount: dryRun.skuCount,
    expectedRevisions,
  }
}

export async function applyPricingCsv(
  input: unknown,
): Promise<PricingMutationResult> {
  const authorized = await authorizedClient()
  if (!authorized.ok) return authorized

  if (
    !isRecord(input) ||
    typeof input.csvText !== "string" ||
    typeof input.dryRunFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(input.dryRunFingerprint)
  ) {
    return validationFailure("Run a fresh dry run before applying the matrix.")
  }

  const expectedRevisions = parseExpectedRevisions(input.expectedRevisions)
  if (!expectedRevisions) {
    return validationFailure("The dry-run revision evidence is invalid.")
  }

  const loaded = await loadCatalogAndRevisions(authorized.supabase)
  if (!loaded.ok) return loaded

  const dryRun = await dryRunPricingMatrixCsv(input.csvText, loaded.catalog)
  if (!dryRun.ok) {
    return validationFailure(
      "The matrix now has validation errors. Nothing was written.",
      dryRun.diagnostics,
    )
  }

  if (dryRun.fingerprint !== input.dryRunFingerprint) {
    return validationFailure(
      "The file changed after the dry run. Run the dry run again.",
    )
  }

  const affectedSkus = dryRun.sets.map((set) => set.sku)
  const revisionSkus = Object.keys(expectedRevisions).sort()
  if (
    affectedSkus.length !== revisionSkus.length ||
    affectedSkus.some((sku, index) => sku !== revisionSkus[index])
  ) {
    return validationFailure(
      "The dry-run SKU evidence no longer matches this file. Run it again.",
    )
  }

  const operations = dryRun.sets.map((set) => ({
    sku: set.sku,
    expected_revision: expectedRevisions[set.sku],
    action: "replace" as const,
    tiers: set.tiers.map((tier) => ({
      tier_start_quantity: tier.tierStartQuantity,
      unit_price_usd: tier.unitPriceUsd,
    })),
  }))

  return runMutation(
    authorized.supabase,
    operations,
    dryRun.fingerprint,
    "Validated CSV matrix import",
    "The complete validated matrix was applied atomically.",
  )
}

function parseTierDrafts(value: unknown): TierDraft[] | null {
  if (!Array.isArray(value) || value.length > 1_000) return null
  const tiers: TierDraft[] = []
  for (const tier of value) {
    if (
      !isRecord(tier) ||
      typeof tier.tierStartQuantity !== "string" ||
      typeof tier.unitPriceUsd !== "string"
    ) {
      return null
    }
    tiers.push({
      tierStartQuantity: tier.tierStartQuantity,
      unitPriceUsd: tier.unitPriceUsd,
    })
  }
  return tiers
}

async function loadOneProduct(
  supabase: ReturnType<typeof createAdminClient>,
  sku: string,
): Promise<PricingCatalogProduct | PricingActionFailure> {
  const { data, error } = await supabase
    .from("products")
    .select("sku, name, min_qty")
    .eq("sku", sku)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    const masked = adminActionError(
      "Could not validate the current product.",
      error,
    )
    return { ...masked, code: "server_error" }
  }
  if (!data) {
    return validationFailure(
      "The SKU does not exactly match an active catalogue product.",
    )
  }

  return {
    sku: String(data.sku),
    name: String(data.name),
    minimumQuantity: Number(data.min_qty),
  }
}

export async function replacePricingTierSet(
  input: unknown,
): Promise<PricingMutationResult> {
  const authorized = await authorizedClient()
  if (!authorized.ok) return authorized

  if (
    !isRecord(input) ||
    typeof input.sku !== "string" ||
    !input.sku ||
    input.sku !== input.sku.trim() ||
    typeof input.expectedRevision !== "string" ||
    !REVISION_PATTERN.test(input.expectedRevision)
  ) {
    return validationFailure("The tier-set request is invalid.")
  }

  const tiers = parseTierDrafts(input.tiers)
  if (!tiers) return validationFailure("The tier rows are invalid.")

  const product = await loadOneProduct(authorized.supabase, input.sku)
  if ("ok" in product && product.ok === false) return product

  const validated = await validateTierSetDraft(
    product as PricingCatalogProduct,
    tiers,
  )
  if (!validated.ok) {
    return validationFailure(
      "The complete tier set has validation errors. Nothing was written.",
      validated.diagnostics,
    )
  }

  return runMutation(
    authorized.supabase,
    [
      {
        sku: validated.set.sku,
        expected_revision: input.expectedRevision,
        action: "replace",
        tiers: validated.set.tiers.map((tier) => ({
          tier_start_quantity: tier.tierStartQuantity,
          unit_price_usd: tier.unitPriceUsd,
        })),
      },
    ],
    validated.fingerprint,
    "Manual complete-set replacement",
    "The complete tier set was replaced atomically.",
  )
}

export async function retirePricingTierSet(
  input: unknown,
): Promise<PricingMutationResult> {
  const authorized = await authorizedClient()
  if (!authorized.ok) return authorized

  if (
    !isRecord(input) ||
    typeof input.sku !== "string" ||
    !input.sku ||
    input.sku !== input.sku.trim() ||
    typeof input.expectedRevision !== "string" ||
    !REVISION_PATTERN.test(input.expectedRevision) ||
    typeof input.confirmationSku !== "string" ||
    input.confirmationSku !== input.sku
  ) {
    return validationFailure(
      "Type the exact SKU to confirm complete pricing retirement.",
    )
  }

  const reason =
    typeof input.reason === "string" ? input.reason.trim() : ""
  if (reason.length > 1_000) {
    return validationFailure("The retirement reason is too long.")
  }

  const sourceFingerprint = await sha256Hex(
    "pricing-retirement:v1\n" + JSON.stringify([input.sku]) + "\n",
  )

  return runMutation(
    authorized.supabase,
    [
      {
        sku: input.sku,
        expected_revision: input.expectedRevision,
        action: "retire",
        tiers: [],
      },
    ],
    sourceFingerprint,
    reason || "Explicit complete-set retirement",
    "The complete tier set was retired atomically.",
  )
}
