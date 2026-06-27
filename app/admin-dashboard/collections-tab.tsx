"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  addCollectionProduct,
  createCollection,
  exportCollectionData,
  removeCollectionProduct,
  softDeleteCollection,
  updateCollectionFilter,
  updateCollectionText,
  updateSortOrder,
} from "./create-actions"
import { TextRow } from "./text-row"
import { parseRequiredNumber } from "./parse-required-number"
import { parseTagInput } from "@/lib/tags"
import { downloadCollection, EXPORT_FORMATS, type ExportFormat } from "@/lib/collection-export"

export interface ProductOption {
  sku: string
  name: string
}

export interface CollectionAdminRow {
  id: string
  slug: string
  name: string
  description: string | null
  filter_tags: string[]
  filter_category: string | null
  sort_order: number
  picked: ProductOption[]
}

export function CollectionsTab({
  collections,
  allProducts,
}: {
  collections: CollectionAdminRow[]
  allProducts: ProductOption[]
}) {
  return (
    <div>
      <AddCollectionForm />
      <p style={styles.help}>
        A collection shows its <strong>hand-picked products</strong> first, then
        any product matching its <strong>saved filter</strong> (tags or
        category). Use one or both. Region tags <code>canada</code>/<code>usa</code>{" "}
        and any tag you set on the Products tab work here too.
      </p>
      {collections.length === 0 ? (
        <p style={styles.empty}>No collections yet. Use the form above to create one.</p>
      ) : null}
      <div style={styles.list}>
        {collections.map((c) => (
          <CollectionCard key={c.id} collection={c} allProducts={allProducts} />
        ))}
      </div>
    </div>
  )
}

function AddCollectionForm() {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      try {
        const result = await createCollection({
          name: name.trim(),
          description: description.trim() || undefined,
        })
        if (result.ok) {
          setStatus({ kind: "ok", message: `Created — "${name.trim()}" now appears below.` })
          router.refresh()
          setName("")
          setDescription("")
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({ kind: "err", message: "Something went wrong. Check your connection and try again." })
      }
    })
  }

  return (
    <details style={styles.addShell}>
      <summary style={styles.addSummary}>
        <strong>+ Create new collection</strong>
      </summary>
      <form onSubmit={handleSubmit} style={styles.addForm}>
        <label style={styles.field}>
          Name *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            style={styles.input}
            placeholder="e.g. Summer Drinkware"
          />
        </label>
        <label style={styles.field}>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={3}
            style={{ ...styles.input, resize: "vertical" }}
            placeholder="Optional — shown on the public collection page."
          />
        </label>
        <button type="submit" disabled={isPending || !name.trim()} style={styles.primaryBtn}>
          {isPending ? "Saving…" : "Create collection"}
        </button>
        {status.message ? (
          <span style={{ ...styles.status, color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444" }}>
            {status.message}
          </span>
        ) : null}
      </form>
    </details>
  )
}

function CollectionCard({
  collection,
  allProducts,
}: {
  collection: CollectionAdminRow
  allProducts: ProductOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState("")

  const pickedSkus = useMemo(() => new Set(collection.picked.map((p) => p.sku)), [collection.picked])
  const available = useMemo(
    () => allProducts.filter((p) => !pickedSkus.has(p.sku)),
    [allProducts, pickedSkus],
  )

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    startTransition(async () => {
      setStatus("Saving…")
      try {
        const r = await fn()
        if (r.ok) {
          setStatus(okMsg)
          router.refresh()
        } else {
          setStatus(r.error ?? "Something went wrong.")
        }
      } catch {
        setStatus("Something went wrong. Check your connection and try again.")
      }
    })
  }

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Delete the "${collection.name}" collection? It will be hidden from the site (re-activate it in the Supabase Table Editor).`)) {
      return
    }
    run(() => softDeleteCollection(collection.id), "Deleted.")
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <strong style={styles.cardTitle}>{collection.name}</strong>
        <div style={styles.cardHeadActions}>
          <a href={`/collections/${collection.slug}`} target="_blank" rel="noopener noreferrer" style={styles.link}>
            View public page ↗
          </a>
          <ExportMenu slug={collection.slug} />
        </div>
      </div>

      <TextRow source="custom" idLabel={`collection:${collection.id}:name`} label="Name" currentValue={collection.name} onSave={(v) => updateCollectionText(collection.id, "name", v)} />
      <TextRow source="custom" idLabel={`collection:${collection.id}:description`} label="Description" currentValue={collection.description ?? ""} onSave={(v) => updateCollectionText(collection.id, "description", v)} />

      <FilterEditor collection={collection} />

      <div style={styles.section}>
        <div style={styles.sectionLabel}>Hand-picked products ({collection.picked.length})</div>
        {collection.picked.length === 0 ? (
          <p style={styles.muted}>None picked yet. Add products below, or rely on the saved filter above.</p>
        ) : (
          <ul style={styles.pickedList}>
            {collection.picked.map((p) => (
              <li key={p.sku} style={styles.pickedItem}>
                <span>{p.name} <span style={styles.muted}>({p.sku})</span></span>
                <button type="button" disabled={isPending} onClick={() => run(() => removeCollectionProduct(collection.id, p.sku), "Removed.")} style={styles.removeBtn}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddProductControl available={available} disabled={isPending} onAdd={(sku) => run(() => addCollectionProduct(collection.id, sku), "Added.")} />
      </div>

      <TextRow source="custom" idLabel={`collection:${collection.id}:sort_order`} label="Display order (lower shows first)" currentValue={String(collection.sort_order)} onSave={(v) => updateSortOrder("collection", collection.id, parseRequiredNumber(v))} />

      <div style={styles.cardFoot}>
        <button type="button" disabled={isPending} onClick={handleDelete} style={styles.dangerBtn}>
          Delete collection
        </button>
        {status ? <span style={styles.status}>{status}</span> : null}
      </div>
    </div>
  )
}

function ExportMenu({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const choose = (format: ExportFormat) => {
    setOpen(false)
    setError("")
    startTransition(async () => {
      try {
        const r = await exportCollectionData(slug)
        if (r.ok) {
          downloadCollection(r.payload, format)
        } else {
          setError(r.error)
        }
      } catch {
        setError("Export failed. Check your connection and try again.")
      }
    })
  }

  return (
    <div style={styles.exportWrap}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Export collection"
        disabled={isPending}
        style={styles.dotsBtn}
        title="Export collection"
      >
        {isPending ? "…" : "⋯"}
      </button>
      {open ? (
        <div role="menu" style={styles.menu}>
          <div style={styles.menuHead}>Export for Mailchimp</div>
          {EXPORT_FORMATS.map(({ format, label }) => (
            <button key={format} role="menuitem" type="button" onClick={() => choose(format)} style={styles.menuItem}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <span style={{ ...styles.status, color: "#b00020" }}>{error}</span> : null}
    </div>
  )
}

function FilterEditor({ collection }: { collection: CollectionAdminRow }) {
  const router = useRouter()
  const [tags, setTags] = useState(collection.filter_tags.join(", "))
  const [category, setCategory] = useState(collection.filter_category ?? "")
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({ kind: "idle", message: "" })

  const dirty =
    tags !== collection.filter_tags.join(", ") || category !== (collection.filter_category ?? "")

  const save = () => {
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      try {
        const r = await updateCollectionFilter(collection.id, parseTagInput(tags), category)
        if (r.ok) {
          setStatus({ kind: "ok", message: "Saved. Live on the site." })
          router.refresh()
        } else {
          setStatus({ kind: "err", message: r.error })
        }
      } catch {
        setStatus({ kind: "err", message: "Something went wrong." })
      }
    })
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>Saved filter (auto-includes matching products)</div>
      <label style={styles.field}>
        Tags (comma-separated)
        <input value={tags} onChange={(e) => setTags(e.target.value)} style={styles.input} placeholder="e.g. canada, eco" />
      </label>
      <label style={styles.field}>
        Category (exact match)
        <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} style={styles.input} placeholder="e.g. Drinkware" />
      </label>
      <button type="button" disabled={isPending || !dirty} onClick={save} style={styles.primaryBtn}>
        {isPending ? "Saving…" : "Save filter"}
      </button>
      {status.message ? (
        <span style={{ ...styles.status, color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444" }}>
          {status.message}
        </span>
      ) : null}
    </div>
  )
}

function AddProductControl({
  available,
  disabled,
  onAdd,
}: {
  available: ProductOption[]
  disabled: boolean
  onAdd: (sku: string) => void
}) {
  const [sku, setSku] = useState("")
  return (
    <div style={styles.addProductRow}>
      <select value={sku} onChange={(e) => setSku(e.target.value)} disabled={disabled || available.length === 0} style={styles.select}>
        <option value="">{available.length === 0 ? "All products already added" : "Add a product…"}</option>
        {available.map((p) => (
          <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled || !sku}
        onClick={() => {
          if (sku) {
            onAdd(sku)
            setSku("")
          }
        }}
        style={styles.primaryBtn}
      >
        Add
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  help: { fontSize: 13, color: "#555", margin: "8px 0 16px", lineHeight: 1.5 },
  empty: { color: "#666", fontSize: 14, padding: "12px 0" },
  list: { display: "flex", flexDirection: "column", gap: 16 },
  addShell: { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12, background: "#fafafa" },
  addSummary: { cursor: "pointer", fontSize: 14 },
  addForm: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#333" },
  input: { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14, fontFamily: "inherit" },
  select: { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14, flex: 1, minWidth: 0 },
  primaryBtn: { alignSelf: "flex-start", padding: "8px 14px", border: "none", borderRadius: 6, background: "#1a1a1a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  dangerBtn: { padding: "7px 12px", border: "1px solid #e0b4b4", borderRadius: 6, background: "#fff", color: "#b00020", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  removeBtn: { padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#b00020", fontSize: 12, cursor: "pointer" },
  status: { fontSize: 13, marginLeft: 8 },
  card: { border: "1px solid #ddd", borderRadius: 8, padding: 16, background: "#fff", display: "flex", flexDirection: "column", gap: 10 },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  cardHeadActions: { display: "flex", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 16 },
  exportWrap: { position: "relative", display: "inline-flex", alignItems: "center", gap: 6 },
  dotsBtn: { width: 30, height: 30, lineHeight: "28px", padding: 0, border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#333", fontSize: 18, cursor: "pointer" },
  menu: { position: "absolute", top: 34, right: 0, zIndex: 10, minWidth: 180, background: "#fff", border: "1px solid #ddd", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, display: "flex", flexDirection: "column", gap: 2 },
  menuHead: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", padding: "4px 8px" },
  menuItem: { textAlign: "left", padding: "7px 8px", border: "none", borderRadius: 6, background: "transparent", color: "#1a1a1a", fontSize: 13, cursor: "pointer" },
  cardFoot: { display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingTop: 10, borderTop: "1px solid #eee" },
  section: { border: "1px solid #eee", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "#fafafa" },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" },
  muted: { color: "#888", fontSize: 12 },
  pickedList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  pickedItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "4px 0" },
  addProductRow: { display: "flex", gap: 8, alignItems: "center" },
  link: { fontSize: 12, color: "#1a56db", textDecoration: "underline" },
}
