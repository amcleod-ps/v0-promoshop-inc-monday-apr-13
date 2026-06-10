"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createProduct,
  createProductColour,
  createProductImage,
  deleteProductColour,
  softDeleteProduct,
  updateProductColour,
  updateProductList,
  updateProductMinQty,
  updateProductText,
  updateSortOrder,
} from "./create-actions"
import { TextRow } from "./text-row"
import { parseRequiredNumber } from "./parse-required-number"
import { MAX_IMAGE_BYTES } from "@/lib/upload-limits"

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
  genders: string[]
  sizes: string[]
  min_qty: number
  sort_order: number
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
  const [brandSlugs, setBrandSlugs] = useState<string[]>([])
  const [genders, setGenders] = useState("")
  const [sizes, setSizes] = useState("")
  const [minQty, setMinQty] = useState("1")
  const router = useRouter()
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const toggleBrand = (slug: string) => {
    setBrandSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      try {
        const result = await createProduct({
          sku: sku.trim(),
          name: name.trim(),
          category: category.trim(),
          description: description.trim() || undefined,
          brandSlugs,
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
            message: `Created "${result.id}" — the new product card now appears below; add colours and images to it.`,
          })
          router.refresh()
          setSku("")
          setName("")
          setCategory("")
          setDescription("")
          setBrandSlugs([])
          setGenders("")
          setSizes("")
          setMinQty("1")
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
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
        the card to add its colours and upload images. Give it at least one
        size (use “One Size” when sizes don&apos;t apply) — customers must pick a
        size to add a product to their quote.
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
          {/* div-based field (not <Field>, which renders a <label>) so the
              per-checkbox labels aren't nested inside another label. */}
          <div style={styles.fieldWrap}>
            <span style={styles.fieldLabel}>Brands (select all that apply)</span>
            <div style={styles.brandChecklist}>
              {brands.length === 0 ? (
                <span style={{ fontSize: 13, color: "#888" }}>No brands yet.</span>
              ) : (
                brands.map((b) => (
                  <label key={b.slug} style={styles.brandCheckItem}>
                    <input
                      type="checkbox"
                      checked={brandSlugs.includes(b.slug)}
                      onChange={() => toggleBrand(b.slug)}
                      disabled={isPending}
                    />
                    <span>{b.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
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
      try {
        const result = await softDeleteProduct(product.sku)
        if (result.ok) {
          setRemoved(true)
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
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

        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:name`}
          label="Product name"
          currentValue={product.name}
          onSave={(v) => updateProductText(product.sku, "name", v)}
        />
        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:category`}
          label="Category"
          currentValue={product.category}
          onSave={(v) => updateProductText(product.sku, "category", v)}
        />
        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:description`}
          label="Description"
          currentValue={product.description ?? ""}
          multiline
          onSave={(v) => updateProductText(product.sku, "description", v)}
        />
        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:sizes`}
          label="Sizes (comma-separated)"
          hint="Customers must pick a size to add a product to their quote, so keep at least one — use “One Size” when sizes don't apply."
          currentValue={product.sizes.join(", ")}
          onSave={(v) =>
            updateProductList(
              product.sku,
              "sizes",
              v.split(",").map((s) => s.trim()).filter(Boolean),
            )
          }
        />
        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:genders`}
          label="Genders (comma-separated)"
          hint="Drives the Men's / Women's / Unisex filter in the studio. Recognised values: Mens, Womens, Unisex."
          currentValue={product.genders.join(", ")}
          onSave={(v) =>
            updateProductList(
              product.sku,
              "genders",
              v.split(",").map((g) => g.trim()).filter(Boolean),
            )
          }
        />
        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:min_qty`}
          label="Minimum order quantity"
          currentValue={String(product.min_qty)}
          onSave={(v) => updateProductMinQty(product.sku, parseRequiredNumber(v))}
        />
        <TextRow
          source="custom"
          idLabel={`product:${product.sku}:sort_order`}
          label="Display order (lower shows first)"
          currentValue={String(product.sort_order)}
          onSave={(v) => updateSortOrder("product", product.sku, parseRequiredNumber(v))}
        />

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
      try {
        const result = await updateProductColour({ id: colour.id, name, hex })
        if (result.ok) {
          setSavedName(name)
          setSavedHex(hex)
          setStatus({ kind: "ok", message: "Saved." })
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
      }
    })
  }

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Delete colour "${savedName}" and ALL its images?`)) {
      return
    }
    setStatus({ kind: "idle", message: "Removing…" })
    startTransition(async () => {
      try {
        const result = await deleteProductColour(colour.id)
        if (result.ok) {
          setRemoved(true)
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
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

      <SortOrderInline
        label="Colour order"
        entity="product_colour"
        id={colour.id}
        current={colour.sort_order}
      />

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
            <SortOrderInline
              label="Order"
              entity="product_image"
              id={img.id}
              current={img.sort_order}
              compact
            />
          </div>
        ))}
      </div>

      <AddImageToColourForm productSku={productSku} colourId={colour.id} colourName={savedName} />
    </div>
  )
}

/**
 * Compact sort_order editor used inside colour cards and image tiles, where
 * a full TextRow would dominate the layout.
 */
function SortOrderInline({
  label,
  entity,
  id,
  current,
  compact,
}: {
  label: string
  entity: "product_colour" | "product_image"
  id: string
  current: number
  compact?: boolean
}) {
  const [value, setValue] = useState(String(current))
  const [savedValue, setSavedValue] = useState(String(current))
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()
  const dirty = value.trim() !== savedValue

  const handleSave = () => {
    setStatus({ kind: "idle", message: "…" })
    startTransition(async () => {
      try {
        const result = await updateSortOrder(entity, id, parseRequiredNumber(value))
        if (result.ok) {
          setSavedValue(value.trim())
          setStatus({ kind: "ok", message: "Saved." })
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
      }
    })
  }

  return (
    <div style={compact ? styles.sortInlineCompact : styles.sortInline}>
      <span style={styles.sortInlineLabel}>{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (status.message) setStatus({ kind: "idle", message: "" })
        }}
        disabled={isPending}
        style={styles.sortInlineInput}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || isPending}
        style={{ ...styles.button, padding: "4px 10px", fontSize: 12 }}
      >
        Save
      </button>
      {status.message ? (
        <span
          style={{
            fontSize: 11,
            color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </div>
  )
}

function AddColourForm({ productSku }: { productSku: string }) {
  const [name, setName] = useState("")
  const [hex, setHex] = useState("#111111")
  const router = useRouter()
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      setStatus({ kind: "idle", message: "Saving…" })
      try {
        const result = await createProductColour({ productSku, name: name.trim(), hex })
        if (result.ok) {
          setStatus({ kind: "ok", message: `Added colour "${name.trim()}" — add images to it below.` })
          router.refresh()
          setName("")
          setHex("#111111")
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
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
  const router = useRouter()

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
    // Pre-check the 10 MB cap client-side: a larger body is rejected by the
    // Server Action transport before our friendly server-side message runs.
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus({
        kind: "err",
        message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      })
      return
    }
    setStatus({ kind: "idle", message: "Uploading…" })
    const fd = new FormData()
    fd.append("file", file)
    const finalLabel = label.trim() || `${productSku} — ${colourName} — new image`
    startTransition(async () => {
      try {
        const result = await createProductImage(productSku, colourId, finalLabel, fd)
        if (result.ok) {
          setStatus({ kind: "ok", message: "Uploaded — it now appears in the gallery." })
          router.refresh()
          setFile(null)
          setLabel("")
        } else {
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setStatus({
          kind: "err",
          message: "Upload failed. Check your connection and try again.",
        })
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
  brandChecklist: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 14px",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 4,
    background: "#fff",
    maxHeight: 140,
    overflowY: "auto",
  },
  brandCheckItem: {
    display: "flex",
    gap: 5,
    alignItems: "center",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  sortInline: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginBottom: 10,
    fontSize: 12,
  },
  sortInlineCompact: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    marginTop: 4,
    fontSize: 11,
  },
  sortInlineLabel: { color: "#666", fontWeight: 600 },
  sortInlineInput: {
    width: 64,
    padding: "4px 6px",
    fontSize: 12,
    border: "1px solid #ccc",
    borderRadius: 4,
  },
}
