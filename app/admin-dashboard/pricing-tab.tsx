"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import type {
  PricingAdminProduct,
  PricingPanelState,
} from "@/lib/pricing/admin-types"
import type { MatrixDiagnostic, TierDraft } from "@/lib/pricing/matrix"
import {
  applyPricingCsv,
  dryRunPricingCsv,
  replacePricingTierSet,
  retirePricingTierSet,
} from "./pricing-actions"

type Status = {
  kind: "idle" | "ok" | "error"
  message: string
  diagnostics?: MatrixDiagnostic[]
}

const idleStatus: Status = { kind: "idle", message: "" }

export function PricingTab({ state }: { state: PricingPanelState }) {
  if (state.kind === "locked") {
    return (
      <Notice tone="warning">
        <strong>Pricing administration is locked.</strong>
        <p style={styles.noticeText}>
          {state.reason === "password_not_configured"
            ? "Configure ADMIN_DASHBOARD_PASSWORD and redeploy before pricing data or controls can load. The other dashboard sections keep their historical access behaviour."
            : "Reload the dashboard and complete the administrator sign-in prompt."}
        </p>
      </Notice>
    )
  }

  if (state.kind === "migration_missing") {
    return (
      <Notice tone="warning">
        <strong>Pricing administration needs migration 0013.</strong>
        <p style={styles.noticeText}>
          Apply the exact reviewed{" "}
          <code>supabase/migrations/0013_pricing_administration.sql</code>,
          verify its inactive postconditions, then refresh.
        </p>
      </Notice>
    )
  }

  if (state.kind === "error") {
    return (
      <Notice tone="error">
        <strong>Pricing administration could not be loaded.</strong>
        <p style={styles.noticeText}>
          Refresh to retry. Database details were recorded only in server logs.
        </p>
      </Notice>
    )
  }

  return <ReadyPricingTab state={state} />
}

function ReadyPricingTab({
  state,
}: {
  state: Extract<PricingPanelState, { kind: "ready" }>
}) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      state.products.filter(
        (product) =>
          !needle ||
          product.sku.toLowerCase().includes(needle) ||
          product.name.toLowerCase().includes(needle),
      ),
    [needle, state.products],
  )

  const inactive = !state.dbFlagEnabled && !state.serverFlagEnabled

  return (
    <div>
      <Notice tone={inactive ? "safe" : "error"}>
        <strong>
          Public pricing is {inactive ? "inactive" : "not fully inactive"}.
        </strong>
        <p style={styles.noticeText}>
          Database flag: <code>{String(state.dbFlagEnabled)}</code> · server
          flag: <code>{String(state.serverFlagEnabled)}</code>. Stage 2 has no
          activation control; both must remain false until the release stage.
        </p>
      </Notice>

      <CsvImporter />

      <section style={styles.section} aria-labelledby="pricing-products-title">
        <div style={styles.sectionHeading}>
          <div>
            <h2 id="pricing-products-title" style={styles.h2}>
              Complete SKU tier sets
            </h2>
            <p style={styles.help}>
              Saving replaces every tier for one SKU in one transaction.
              Empty saves are rejected; retirement is a separate confirmed
              operation.
            </p>
          </div>
          <span style={styles.count}>{filtered.length} products</span>
        </div>

        <div style={styles.searchRow}>
          <label htmlFor="pricing-product-search" style={styles.srOnly}>
            Search pricing products
          </label>
          <input
            id="pricing-product-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by SKU or product name…"
            style={styles.input}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={styles.secondaryButton}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div style={styles.productList}>
          {filtered.map((product) => (
            <ProductPricingEditor
              key={product.sku + ":" + product.revision}
              product={product}
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <p style={styles.empty}>No products match this search.</p>
        ) : null}
      </section>

      <AuditList entries={state.recentAudit} />
    </div>
  )
}

function CsvImporter() {
  const router = useRouter()
  const fileSelectionToken = useRef(0)
  const [fileName, setFileName] = useState("")
  const [csvText, setCsvText] = useState("")
  const [readingFile, setReadingFile] = useState(false)
  const [status, setStatus] = useState<Status>(idleStatus)
  const [dryRun, setDryRun] = useState<{
    fingerprint: string
    rowCount: number
    skuCount: number
    expectedRevisions: Record<string, string>
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const token = fileSelectionToken.current + 1
    fileSelectionToken.current = token
    const file = event.target.files?.[0]
    setDryRun(null)
    setStatus(idleStatus)
    setFileName("")
    setCsvText("")
    setReadingFile(Boolean(file))
    if (!file) return

    try {
      const contents = await file.text()
      if (fileSelectionToken.current !== token) return
      setFileName(file.name)
      setCsvText(contents)
    } catch {
      if (fileSelectionToken.current !== token) return
      setStatus({
        kind: "error",
        message: "The selected file could not be read.",
      })
    } finally {
      if (fileSelectionToken.current === token) setReadingFile(false)
    }
  }

  const runDryRun = () => {
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Validating every row…" })
      try {
        const result = await dryRunPricingCsv({ csvText })
        if (!result.ok) {
          setDryRun(null)
          setStatus({
            kind: "error",
            message: result.error,
            diagnostics: result.diagnostics,
          })
          return
        }
        setDryRun(result)
        setStatus({
          kind: "ok",
          message:
            "Dry run passed: " +
            result.rowCount +
            " rows across " +
            result.skuCount +
            " SKUs. Nothing has been written.",
        })
      } catch {
        setDryRun(null)
        setStatus({
          kind: "error",
          message:
            "The dry run could not reach the server. Nothing was written; retry when the connection is stable.",
        })
      }
    })
  }

  const apply = () => {
    if (!dryRun) return
    startTransition(async () => {
      setStatus({
        kind: "idle",
        message: "Revalidating and applying the complete matrix…",
      })
      try {
        const result = await applyPricingCsv({
          csvText,
          dryRunFingerprint: dryRun.fingerprint,
          expectedRevisions: dryRun.expectedRevisions,
        })
        if (!result.ok) {
          setDryRun(null)
          setStatus({
            kind: "error",
            message: result.error,
            diagnostics: result.diagnostics,
          })
          return
        }
        setStatus({
          kind: "ok",
          message:
            result.message +
            " Reconciliation " +
            result.reconciliationFingerprint.slice(0, 12) +
            "…",
        })
        setDryRun(null)
        router.refresh()
      } catch {
        setDryRun(null)
        setStatus({
          kind: "error",
          message:
            "The apply request lost contact with the server. Refresh and inspect the audit before retrying.",
        })
      }
    })
  }

  return (
    <section style={styles.section} aria-labelledby="matrix-import-title">
      <h2 id="matrix-import-title" style={styles.h2}>
        Validated CSV import
      </h2>
      <p style={styles.help}>
        Uses the exact six-column pricing matrix template. A dry run reports
        every detectable row error. Apply is enabled only after the same file
        passes, and the server validates it again before one atomic write.
        SKUs omitted from the file remain unchanged.
      </p>

      <div style={styles.importControls}>
        <label style={styles.fileLabel}>
          <span>Pricing matrix CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={chooseFile}
            disabled={pending || readingFile}
          />
        </label>
        {fileName ? <span style={styles.fileName}>{fileName}</span> : null}
      </div>

      <div style={styles.buttonRow}>
        <button
          type="button"
          onClick={runDryRun}
          disabled={pending || readingFile || !csvText}
          style={styles.primaryButton}
        >
          {readingFile ? "Reading file…" : pending ? "Working…" : "Run dry run"}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={pending || readingFile || !dryRun}
          style={styles.dangerButton}
        >
          Apply validated matrix
        </button>
      </div>

      {dryRun ? (
        <p style={styles.fingerprint}>
          Source fingerprint: <code>{dryRun.fingerprint}</code>
        </p>
      ) : null}
      <StatusMessage status={status} />
    </section>
  )
}

function ProductPricingEditor({
  product,
}: {
  product: PricingAdminProduct
}) {
  const router = useRouter()
  const [tiers, setTiers] = useState<TierDraft[]>(
    product.tiers.map((tier) => ({
      tierStartQuantity: String(tier.tierStartQuantity),
      unitPriceUsd: tier.unitPriceUsd,
    })),
  )
  const [status, setStatus] = useState<Status>(idleStatus)
  const [confirmation, setConfirmation] = useState("")
  const [retirementReason, setRetirementReason] = useState("")
  const [pending, startTransition] = useTransition()

  const updateTier = (
    index: number,
    field: keyof TierDraft,
    value: string,
  ) => {
    setTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [field]: value } : tier,
      ),
    )
    setStatus(idleStatus)
  }

  const addTier = () => {
    setTiers((current) => [
      ...current,
      {
        tierStartQuantity:
          current.length === 0 ? String(product.minimumQuantity) : "",
        unitPriceUsd: "",
      },
    ])
    setStatus(idleStatus)
  }

  const removeTier = (index: number) => {
    setTiers((current) =>
      current.filter((_, tierIndex) => tierIndex !== index),
    )
    setStatus(idleStatus)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Validating and saving…" })
      try {
        const result = await replacePricingTierSet({
          sku: product.sku,
          expectedRevision: product.revision,
          tiers,
        })
        if (!result.ok) {
          setStatus({
            kind: "error",
            message: result.error,
            diagnostics: result.diagnostics,
          })
          return
        }
        setStatus({ kind: "ok", message: result.message })
        router.refresh()
      } catch {
        setStatus({
          kind: "error",
          message:
            "The save request lost contact with the server. Refresh and inspect the current revision before retrying.",
        })
      }
    })
  }

  const retire = () => {
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Retiring the complete set…" })
      try {
        const result = await retirePricingTierSet({
          sku: product.sku,
          expectedRevision: product.revision,
          confirmationSku: confirmation,
          reason: retirementReason,
        })
        if (!result.ok) {
          setStatus({
            kind: "error",
            message: result.error,
            diagnostics: result.diagnostics,
          })
          return
        }
        setStatus({ kind: "ok", message: result.message })
        setConfirmation("")
        router.refresh()
      } catch {
        setStatus({
          kind: "error",
          message:
            "The retirement request lost contact with the server. Refresh and inspect the audit before retrying.",
        })
      }
    })
  }

  return (
    <details style={styles.productCard}>
      <summary style={styles.productSummary}>
        <span>
          <strong>{product.sku}</strong> · {product.name}
        </span>
        <span style={styles.summaryMeta}>
          MOQ {product.minimumQuantity} · {product.isActive ? "catalogue active" : "catalogue inactive"} · {product.status} · rev{" "}
          {product.revision}
        </span>
      </summary>

      <div style={styles.productBody}>
        {!product.isActive ? (
          <Notice tone="warning">
            <strong>This catalogue product is inactive.</strong>
            <p style={styles.noticeText}>
              Existing active pricing can still be retired for recovery. New or
              replacement tiers require reactivating the product first.
            </p>
          </Notice>
        ) : null}
        <p style={styles.help}>
          Revision {product.revision}
          {product.updatedAt
            ? " · changed " + new Date(product.updatedAt).toLocaleString()
            : " · no pricing history"}
        </p>

        <form onSubmit={save}>
          <div style={styles.tierList}>
            {tiers.map((tier, index) => (
              <fieldset key={index} style={styles.tierRow}>
                <legend style={styles.legend}>Tier {index + 1}</legend>
                <label style={styles.fieldLabel}>
                  <span>Starts at quantity</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tier.tierStartQuantity}
                    onChange={(event) =>
                      updateTier(
                        index,
                        "tierStartQuantity",
                        event.target.value,
                      )
                    }
                    disabled={pending || !product.isActive}
                    style={styles.input}
                  />
                </label>
                <label style={styles.fieldLabel}>
                  <span>Unit price (USD)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tier.unitPriceUsd}
                    onChange={(event) =>
                      updateTier(index, "unitPriceUsd", event.target.value)
                    }
                    disabled={pending || !product.isActive}
                    placeholder="0.0000"
                    style={styles.input}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeTier(index)}
                  disabled={pending || !product.isActive}
                  style={styles.secondaryButton}
                  aria-label={"Remove tier " + (index + 1)}
                >
                  Remove
                </button>
              </fieldset>
            ))}
          </div>

          <div style={styles.buttonRow}>
            <button
              type="button"
              onClick={addTier}
              disabled={pending || !product.isActive}
              style={styles.secondaryButton}
            >
              + Add tier
            </button>
            <button
              type="submit"
              disabled={pending || !product.isActive}
              style={styles.primaryButton}
            >
              Save complete set
            </button>
          </div>
        </form>

        <details style={styles.retireBox}>
          <summary style={styles.retireSummary}>
            Retire all pricing for this SKU
          </summary>
          <p style={styles.help}>
            Retirement removes the complete tier set and records a distinct
            audit event. It does not delete the product.
          </p>
          <label style={styles.fieldLabel}>
            <span>
              Type <strong>{product.sku}</strong> to confirm
            </span>
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending || product.status !== "active"}
              style={styles.input}
            />
          </label>
          <label style={styles.fieldLabel}>
            <span>Reason (optional)</span>
            <input
              type="text"
              value={retirementReason}
              onChange={(event) => setRetirementReason(event.target.value)}
              disabled={pending || product.status !== "active"}
              maxLength={1000}
              style={styles.input}
            />
          </label>
          <button
            type="button"
            onClick={retire}
            disabled={
              pending ||
              product.status !== "active" ||
              confirmation !== product.sku
            }
            style={styles.dangerButton}
          >
            Retire complete set
          </button>
        </details>

        <StatusMessage status={status} />
      </div>
    </details>
  )
}

function StatusMessage({ status }: { status: Status }) {
  if (!status.message && !status.diagnostics?.length) return null
  const isError = status.kind === "error"
  return (
    <div
      role={isError ? "alert" : undefined}
      aria-live={isError ? undefined : "polite"}
      style={{
        ...styles.status,
        ...(isError
          ? styles.statusError
          : status.kind === "ok"
            ? styles.statusOk
            : {}),
      }}
    >
      {status.message ? <p style={{ margin: 0 }}>{status.message}</p> : null}
      {status.diagnostics?.length ? (
        <ul style={styles.diagnosticList}>
          {status.diagnostics.map((item, index) => (
            <li key={item.code + ":" + index}>
              {item.record ? "Row " + item.record + ": " : ""}
              {item.field ? item.field + " — " : ""}
              {item.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function AuditList({
  entries,
}: {
  entries: Extract<PricingPanelState, { kind: "ready" }>["recentAudit"]
}) {
  return (
    <section style={styles.section} aria-labelledby="pricing-audit-title">
      <h2 id="pricing-audit-title" style={styles.h2}>
        Recent pricing audit
      </h2>
      <p style={styles.help}>
        The shared Basic-auth username is ignored, so events are truthfully
        attributed to the authenticated admin channel rather than a named
        person.
      </p>
      {entries.length === 0 ? (
        <p style={styles.empty}>No pricing changes have been recorded.</p>
      ) : (
        <ol style={styles.auditList}>
          {entries.map((entry) => (
            <li key={entry.id} style={styles.auditItem}>
              <strong>
                {entry.productSku} · {entry.action}
              </strong>
              <span>
                rev {entry.previousRevision} → {entry.revision} ·{" "}
                {entry.previousTierCount} → {entry.tierCount} tiers
              </span>
              <span>
                {new Date(entry.changedAt).toLocaleString()} · {entry.actor}
              </span>
              {entry.reason ? <span>{entry.reason}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: "safe" | "warning" | "error"
  children: React.ReactNode
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        ...styles.notice,
        ...(tone === "safe"
          ? styles.noticeSafe
          : tone === "error"
            ? styles.noticeError
            : styles.noticeWarning),
      }}
    >
      {children}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 18,
    marginBottom: 20,
  },
  sectionHeading: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
  },
  h2: { fontSize: 20, margin: "0 0 6px" },
  help: {
    color: "#555",
    fontSize: 14,
    lineHeight: 1.5,
    margin: "4px 0 14px",
  },
  count: { color: "#666", fontSize: 13 },
  notice: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    lineHeight: 1.45,
  },
  noticeSafe: {
    background: "#f1fbf5",
    border: "1px solid #8ac7a0",
    color: "#155d32",
  },
  noticeWarning: {
    background: "#fffaf0",
    border: "1px solid #e7bd57",
    color: "#6c4c08",
  },
  noticeError: {
    background: "#fff4f4",
    border: "1px solid #e5a0a0",
    color: "#7a1818",
  },
  noticeText: { margin: "8px 0 0" },
  importControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  fileLabel: {
    display: "grid",
    gap: 6,
    fontWeight: 600,
    fontSize: 14,
  },
  fileName: { color: "#555", fontSize: 13 },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    alignItems: "center",
  },
  primaryButton: {
    border: 0,
    borderRadius: 5,
    padding: "10px 14px",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #bbb",
    borderRadius: 5,
    padding: "9px 12px",
    background: "#fff",
    color: "#222",
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #a32121",
    borderRadius: 5,
    padding: "9px 12px",
    background: "#fff5f5",
    color: "#8a1515",
    fontWeight: 700,
    cursor: "pointer",
  },
  fingerprint: {
    overflowWrap: "anywhere",
    fontSize: 12,
    color: "#555",
    marginTop: 12,
  },
  searchRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    margin: "12px 0 16px",
  },
  input: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    border: "1px solid #bbb",
    borderRadius: 5,
    padding: "9px 10px",
    font: "inherit",
    background: "#fff",
  },
  productList: { display: "grid", gap: 10 },
  productCard: {
    border: "1px solid #d5d5d5",
    borderRadius: 7,
    background: "#fafafa",
    overflow: "hidden",
  },
  productSummary: {
    cursor: "pointer",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    padding: "13px 14px",
  },
  summaryMeta: { color: "#666", fontSize: 13 },
  productBody: {
    borderTop: "1px solid #ddd",
    background: "#fff",
    padding: 14,
  },
  tierList: { display: "grid", gap: 10 },
  tierRow: {
    border: "1px solid #ddd",
    borderRadius: 6,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    alignItems: "end",
    padding: 12,
    minWidth: 0,
  },
  legend: { fontWeight: 700, padding: "0 5px" },
  fieldLabel: {
    display: "grid",
    gap: 5,
    fontSize: 13,
    fontWeight: 600,
    minWidth: 0,
    marginBottom: 10,
  },
  retireBox: {
    marginTop: 18,
    border: "1px solid #e1b0b0",
    borderRadius: 6,
    padding: 12,
    background: "#fffafa",
  },
  retireSummary: {
    cursor: "pointer",
    color: "#8a1515",
    fontWeight: 700,
  },
  status: {
    marginTop: 14,
    padding: 10,
    borderRadius: 5,
    background: "#f4f4f4",
    color: "#333",
    fontSize: 13,
  },
  statusError: {
    background: "#fff0f0",
    color: "#7a1818",
    border: "1px solid #edb5b5",
  },
  statusOk: {
    background: "#effaf3",
    color: "#155d32",
    border: "1px solid #a9d7b9",
  },
  diagnosticList: {
    margin: "8px 0 0 20px",
    padding: 0,
    display: "grid",
    gap: 4,
  },
  auditList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: 8,
  },
  auditItem: {
    display: "grid",
    gap: 3,
    padding: 10,
    border: "1px solid #ddd",
    borderRadius: 5,
    color: "#555",
    fontSize: 13,
  },
  empty: { color: "#666", fontStyle: "italic" },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
}
