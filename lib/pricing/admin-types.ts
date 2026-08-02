import type {
  MatrixDiagnostic,
  TierDraft,
} from "./matrix"

export interface PricingAdminTier {
  tierStartQuantity: number
  unitPriceUsd: string
}

export interface PricingAdminProduct {
  sku: string
  name: string
  minimumQuantity: number
  revision: string
  status: "never_configured" | "active" | "retired"
  fingerprint: string | null
  updatedAt: string | null
  tiers: PricingAdminTier[]
}

export interface PricingAuditEntry {
  id: string
  changeId: string
  productSku: string
  action: "replace" | "retire"
  previousRevision: string
  revision: string
  previousTierCount: number
  tierCount: number
  actor: string
  reason: string | null
  sourceFingerprint: string
  changedAt: string
}

export type PricingPanelState =
  | {
      kind: "locked"
      reason: "password_not_configured" | "unauthorized"
    }
  | { kind: "migration_missing" }
  | { kind: "error" }
  | {
      kind: "ready"
      dbFlagEnabled: boolean
      serverFlagEnabled: boolean
      products: PricingAdminProduct[]
      recentAudit: PricingAuditEntry[]
    }

export type PricingActionFailureCode =
  | "not_configured"
  | "not_authorized"
  | "validation"
  | "conflict"
  | "server_error"

export type PricingActionFailure = {
  ok: false
  code: PricingActionFailureCode
  error: string
  diagnostics?: MatrixDiagnostic[]
}

export type PricingMutationSuccess = {
  ok: true
  message: string
  reconciliationFingerprint: string
}

export type PricingMutationResult =
  | PricingMutationSuccess
  | PricingActionFailure

export type PricingDryRunResult =
  | {
      ok: true
      fingerprint: string
      rowCount: number
      skuCount: number
      expectedRevisions: Record<string, string>
    }
  | PricingActionFailure

export interface PricingCsvInput {
  csvText: string
}

export interface PricingCsvApplyInput extends PricingCsvInput {
  dryRunFingerprint: string
  expectedRevisions: Record<string, string>
}

export interface PricingReplaceInput {
  sku: string
  expectedRevision: string
  tiers: TierDraft[]
}

export interface PricingRetireInput {
  sku: string
  expectedRevision: string
  confirmationSku: string
  reason?: string
}
