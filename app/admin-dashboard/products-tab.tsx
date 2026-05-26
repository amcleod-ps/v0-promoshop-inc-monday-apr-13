"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  createProduct,
  createProductColour,
  createProductImage,
  deleteProductColour,
  softDeleteProduct,
  updateProductColour,
} from "./create-actions"

interface ProductImage {
  id: string
  label: string
  url: string | null
  sort_order: number
}

interface ProductColour {
  id: string
  name: string
  hex: string
  sort_order: number
  images: ProductImage[]
}

export interface ProductRow {
  sku: string
  name: string
  category: string
  description: string | null
  brand_slugs: string[]
  colours: ProductColour[]
}

interface BrandOption {
  slug: string
  name: string
}

export function ProductsTab({
  products,
  brands,
}: {
  products: ProductRow[]
  brands: BrandOption[]
}) {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!needle) return products
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(needle) ||
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle),
    )
  }, [products, needle])

  return (
    <div>
      <AddProductForm brands={brands} />

      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Filter products by SKU, name, or category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={styles.search}
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} style={styles.clearBtn}>
            Clear
          </button>
        ) : null}
        <span style={styles.matchCount}>
          {filtered.length} of {products.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={styles.empty}>
          {products.length === 0
            ? "No products yet. Add one above."
            : `No products match "${q}".`}
        </p>
      ) : null}

      <div style={styles.list}>
        {filtered.map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </div>
    </div>
  )
}

function AddProductForm({ brands }: { brands: BrandOption[] }) {
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [brandSlug, setBrandSlug] = useState("")
  const [genders, setGenders] = useState("")
  const [sizes, setSizes] = useState("")
  const [minQty, setMinQty] = useState("1")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      const result = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || undefined,
        brandSlugs: brandSlug ? [brandSlug] : [],
        genders: genders
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean),
        sizes: sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        minQty: Number(minQty) || 1,
      })
      if (result.ok) {
        setStatus({
          kind: "ok",
          message: `Created "${result.id}". Refresh to see the new product card below, then add colours and images.`,
        })
        setSku("")
        setName("")
        setCategory("")
        setDescription("")
        setBrandSlug("")
        setGenders("")
        setSizes("")
        setMinQty("1")
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <details style={styles.addShell}>
      <summary style={styles.addSummary}>
        <strong>+ Add new product (SKU)</strong>
      </summary>
      <p style={styles.helpNote}>
        Creates the product row. After it appears in the list below, expand
        the card to add its colours and upload images.
      </p>
      <form onSubmit={handleSubmit} style={styles.addForm}>
        <div style={styles.formRow}>
          <Field label="SKU *">
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              disabled={isPending}
              style={styles.input}
              placeholder="e.g. DRK 023"
            />
          </Field>
          <Field label="Category *">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isPending}
              style={styles.input}
              placeholder="e.g. Drinkware, Tops, Bags"
            />
          </Field>
        </div>
        <Field label="Product name *">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            style={styles.input}
            placeholder="e.g. Stanley Quencher H2.0 30oz"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            rows={3}
            style={{ ...styles.input, resize: "vertical" }}
          />
        </Field>
        <div style={styles.formRow}>
          <Field label="Brand">
            <select
              value={brandSlug}
              onChange={(e) => setBrandSlug(e.target.value)}
              disabled={isPending || brands.length === 0}
              style={styles.input}
            >
              <option value="">— None —</option>
              {brands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum order qty">
            <input
              type="number"
              min={1}
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              disabled={isPending}
              style={styles.input}
            />
          </Field>
        </div>
        <div style={styles.formRow}>
          <Field label="Genders (comma-separated)">
            <input
              type="text"
              value={genders}
              onChange={(e) => setGenders(e.target.value)}
              disabled={isPending}
              style={styles.input}
              placeholder="e.g. Mens, Womens, Unisex"
            />
          </Field>
          <Field label="Sizes (comma-separated)">
            <input
              type="text"
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              disabled={isPending}
              style={styles.input}
              placeholder="e.g. S, M, L, XL"
            />
          </Field>
        </div>
        <div style={styles.actionsRow}>
          <button
            type="submit"
            disabled={isPending || !sku.trim() || !name.trim() || !category.trim()}
            style={styles.button}
          >
            {isPending ? "Saving…" : "Create product"}
          </button>
          {status.message ? (
            <span
              style={{
                ...styles.status,
                color:
                  status.kind === "err"
                    ? "#b00020"
                    : status.kind === "ok"
                      ? "#0a7f3f"
                      : "#444",
              }}
            >
              {status.message}
            </span>
          ) : null}
        </div>
      </form>
    </details>
  )
}

function ProductCard({ product }: { product: ProductRow }) {
  const [removed, setRemoved] = useState(false)
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  if (removed) {
    return (
      <div style={{ ...styles.card, opacity: 0.6 }}>
        <p style={styles.removedNote}>{product.name} removed from the public site.</p>
      </div>
    )
  }

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Remove ${product.sku} (${product.name}) from the public site?`)) {
      return
    }
    setStatus({ kind: "idle", message: "Removing…" })
    startTransition(async () => {
      const result = await softDeleteProduct(product.sku)
      if (result.ok) {
        setRemoved(true)
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <details style={styles.card}>
      <summary style={styles.cardSummary}>
        <strong>{product.sku}</strong> · {product.name}
        <span style={styles.cardMeta}>
          {" "}· {product.category} · {product.colours.length} colour
          {product.colours.length === 1 ? "" : "s"}
        </span>
      </summary>
      <div style={styles.cardBody}>
        <div style={styles.deleteRow}>
          <button type="button" onClick={handleDelete} disabled={isPending} style={styles.removeButton}>
            Remove product
          </button>
          {status.message ? (
            <span style={{ ...styles.status, color: "#b00020" }}>{status.message}</span>
          ) : null}
        </div>

        <div style={styles.coloursList}>
          {product.colours.map((c) => (
            <ColourEditor key={c.id} productSku={product.sku} colour={c} />
          ))}
        </div>

        <AddColourForm productSku={product.sku} />
      </div>
    </details>
  )
}

function ColourEditor({
  productSku,
  colour,
}: {
  productSku: string
  colour: ProductColour
}) {
  const [name, setName] = useState(colour.name)
  const [hex, setHex] = useState(colour.hex)
  const [savedName, setSavedName] = useState(colour.name)
  const [savedHex, setSavedHex] = useState(colour.hex)
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()
  const [removed, setRemoved] = useState(false)
  const dirty = name !== savedName || hex.toLowerCase() !== savedHex.toLowerCase()

  if (removed) return null

  const handleSave = () => {
    setStatus({ kind: "idle", message: "Saving…" })
    startTransition(async () => {
      const result = await updateProductColour({ id: colour.id, name, hex })
      if (result.ok) {
        setSavedName(name)
        setSavedHex(hex)
        setStatus({ kind: "ok", message: "Saved." })
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Delete colour "${savedName}" and ALL its images?`)) {
      return
    }
    setStatus({ kind: "idle", message: "Removing…" })
    startTransition(async () => {
      const result = await deleteProductColour(colour.id)
      if (result.ok) {
        setRemoved(true)
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <div style={styles.colourCard}>
      <div style={styles.colourHeader}>
        <div
          style={{ ...styles.colourSwatch, background: hex }}
          aria-hidden
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          style={{ ...styles.input, maxWidth: 180 }}
          placeholder="Colour name"
        />
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          disabled={isPending}
          style={styles.colorPicker}
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          disabled={isPending}
          style={{ ...styles.input, maxWidth: 110, fontFamily: "monospace" }}
          maxLength={9}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isPending}
          style={styles.button}
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          style={styles.removeButton}
        >
          Delete colour
        </button>
        {status.message ? (
          <span
            style={{
              ...styles.status,
              color:
                status.kind === "err"
                  ? "#b00020"
                  : status.kind === "ok"
                    ? "#0a7f3f"
                    : "#444",
            }}
          >
            {status.message}
          </span>
        ) : null}
      </div>

      <div style={styles.imagesGrid}>
        {colour.images.map((img) => (
          <div key={img.id} style={styles.imageTile}>
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt={img.label} style={styles.imageThumb} />
            ) : (
              <div style={styles.imageEmpty}>—</div>
            )}
            <div style={styles.imageLabel}>{img.label}</div>
          </div>
        ))}
      </div>

      <AddImageToColourForm productSku={productSku} colourId={colour.id} colourName={savedName} />
    </div>
  )
}

function AddColourForm({ productSku }: { productSku: string }) {
  const [name, setName] = useState("")
  const [hex, setHex] = useState("#111111")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      const result = await createProductColour({ productSku, name: name.trim(), hex })
      if (result.ok) {
        setStatus({ kind: "ok", message: `Created. Refresh to upload images for "${name.trim()}".` })
        setName("")
        setHex("#111111")
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={styles.addColourForm}>
      <strong style={{ fontSize: 13 }}>+ Add colour</strong>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isPending}
        placeholder="Colour name (e.g. Forest Green)"
        style={{ ...styles.input, maxWidth: 220 }}
      />
      <input
        type="color"
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        disabled={isPending}
        style={styles.colorPicker}
      />
      <input
        type="text"
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        disabled={isPending}
        style={{ ...styles.input, maxWidth: 110, fontFamily: "monospace" }}
        maxLength={9}
      />
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        style={styles.button}
      >
        {isPending ? "Saving…" : "Create"}
      </button>
      {status.message ? (
        <span
          style={{
            ...styles.status,
            color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </form>
  )
}

function AddImageToColourForm({
  productSku,
  colourId,
  colourName,
}: {
  productSku: string
  colourId: string
  colourName: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!file) {
      setFilePreview(null)
      return
    }
    const u = URL.createObjectURL(file)
    setFilePreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    setStatus({ kind: "idle", message: "Uploading…" })
    const fd = new FormData()
    fd.append("file", file)
    const finalLabel = label.trim() || `${productSku} — ${colourName} — new image`
    startTransition(async () => {
      const result = await createProductImage(productSku, colourId, finalLabel, fd)
      if (result.ok) {
        setStatus({ kind: "ok", message: "Uploaded. Refresh to see it in the gallery." })
        setFile(null)
        setLabel("")
      } else {
        setStatus({ kind: "err", message: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={styles.addImageForm}>
      <strong style={{ fontSize: 12 }}>+ Add image to {colourName}</strong>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={isPending}
        style={styles.fileInput}
      />
      {filePreview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={filePreview} alt="Preview" style={styles.smallPreview} />
        </>
      ) : null}
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={isPending}
        placeholder="Optional label"
        style={{ ...styles.input, maxWidth: 240 }}
      />
      <button type="submit" disabled={isPending || !file} style={styles.button}>
        {isPending ? "…" : "Upload"}
      </button>
      {status.message ? (
        <span
          style={{
            ...styles.status,
            color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={styles.fieldWrap}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

const styles: Record<string, React.CSSProperties> = {
  addShell: {
    border: "1px dashed #999",
    borderRadius: 6,
    padding: "10px 14px",
    background: "#fcfcff",
    marginBottom: 16,
  },
  addSummary: { cursor: "pointer", fontSize: 14 },
  helpNote: { color: "#555", fontSize: 13, margin: "10px 0", lineHeight: 1.5 },
  addForm: { display: "flex", flexDirection: "column", gap: 10 },
  formRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  searchWrap: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
  },
  search: {
    flex: 1,
    padding: "10px 14px",
    fontSize: 15,
    border: "2px solid #111",
    borderRadius: 6,
    background: "#fff",
  },
  clearBtn: {
    padding: "6px 14px",
    fontSize: 13,
    background: "transparent",
    color: "#444",
    border: "1px solid #ccc",
    borderRadius: 4,
    cursor: "pointer",
  },
  matchCount: { fontSize: 13, color: "#666", fontWeight: 600 },
  empty: { color: "#666", fontStyle: "italic" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: {
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    padding: "10px 14px",
  },
  cardSummary: { cursor: "pointer", padding: "4px 0", fontSize: 14 },
  cardMeta: { color: "#666", fontSize: 13 },
  cardBody: { marginTop: 12, display: "flex", flexDirection: "column", gap: 14 },
  deleteRow: { display: "flex", gap: 10, alignItems: "center" },
  coloursList: { display: "flex", flexDirection: "column", gap: 12 },
  colourCard: {
    border: "1px solid #eee",
    borderRadius: 6,
    padding: 12,
    background: "#fafafa",
  },
  colourHeader: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  colourSwatch: {
    width: 28,
    height: 28,
    border: "1px solid #ccc",
    borderRadius: 4,
    flexShrink: 0,
  },
  colorPicker: {
    width: 38,
    height: 32,
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: 2,
    cursor: "pointer",
  },
  imagesGrid: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 },
  imageTile: { width: 100 },
  imageThumb: {
    width: 100,
    height: 80,
    objectFit: "contain",
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 4,
  },
  imageEmpty: {
    width: 100,
    height: 80,
    background: "#fff",
    border: "1px dashed #ddd",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#aaa",
  },
  imageLabel: {
    fontSize: 10,
    color: "#666",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  addColourForm: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "10px 12px",
    background: "#fff",
    border: "1px dashed #ccc",
    borderRadius: 4,
  },
  addImageForm: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 8,
    background: "#fff",
    border: "1px dashed #ddd",
    borderRadius: 4,
  },
  fileInput: { fontSize: 12 },
  smallPreview: {
    width: 56,
    height: 44,
    objectFit: "contain",
    border: "1px solid #0066cc",
    borderRadius: 3,
    background: "#fff",
  },
  fieldWrap: { flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 180 },
  fieldLabel: { fontSize: 12, color: "#444", fontWeight: 600 },
  input: {
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  button: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  removeButton: {
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    background: "#fff",
    color: "#b00020",
    border: "1px solid #b00020",
    borderRadius: 4,
    cursor: "pointer",
  },
  actionsRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  status: { fontSize: 13 },
  removedNote: { color: "#0a7f3f", fontWeight: 600, margin: 0 },
}
