import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardList, type ProductGroup } from "./dashboard-list"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Image Dashboard",
  robots: { index: false, follow: false },
}

interface ProductImageJoinedRow {
  id: string
  label: string
  url: string | null
  sort_order: number
  product_sku: string
  products: { name: string } | { name: string }[] | null
}

export default async function AdminDashboardPage() {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return (
      <main style={pageStyles.main}>
        <h1 style={pageStyles.h1}>Image Dashboard</h1>
        <div style={pageStyles.error}>
          <strong>Server is not configured.</strong>
          <p>{err instanceof Error ? err.message : "Unknown error."}</p>
          <p>
            Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to the Vercel project
            (Settings → Environment Variables) and redeploy. The value is the
            <em> service_role </em> secret on the Supabase Dashboard → Project
            Settings → API page.
          </p>
        </div>
      </main>
    )
  }

  const [siteImagesRes, brandsRes, heroSlidesRes, productImagesRes] =
    await Promise.all([
      supabase
        .from("site_images")
        .select("key, label, url, alt_text")
        .order("label", { ascending: true }),
      supabase
        .from("brands")
        .select("slug, name, logo_url")
        .order("sort_order", { ascending: true }),
      supabase
        .from("hero_slides")
        .select("id, title, image_url, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("product_images")
        .select(
          "id, label, url, sort_order, product_sku, products(name)",
        )
        .order("product_sku", { ascending: true })
        .order("sort_order", { ascending: true }),
    ])

  const errors = [
    siteImagesRes.error,
    brandsRes.error,
    heroSlidesRes.error,
    productImagesRes.error,
  ].filter(Boolean) as Array<{ message: string }>

  const siteImages = siteImagesRes.data ?? []
  const brands = brandsRes.data ?? []
  const heroSlides = heroSlidesRes.data ?? []
  const productImages = (productImagesRes.data as ProductImageJoinedRow[] | null) ?? []

  const productGroupMap = new Map<string, ProductGroup>()
  for (const img of productImages) {
    const productName = Array.isArray(img.products)
      ? img.products[0]?.name ?? ""
      : img.products?.name ?? ""
    const group =
      productGroupMap.get(img.product_sku) ??
      ({ sku: img.product_sku, name: productName, images: [] } as ProductGroup)
    if (!group.name && productName) group.name = productName
    group.images.push({
      id: img.id,
      label: img.label,
      url: img.url,
      product_sku: img.product_sku,
    })
    productGroupMap.set(img.product_sku, group)
  }
  const productGroups = Array.from(productGroupMap.values())

  const totalImages =
    siteImages.length +
    brands.length +
    heroSlides.length +
    productGroups.reduce((n, g) => n + g.images.length, 0)

  return (
    <main style={pageStyles.main}>
      <h1 style={pageStyles.h1}>Image Dashboard</h1>

      <details style={pageStyles.help}>
        <summary style={pageStyles.helpSummary}>
          How to use this page
        </summary>
        <ol style={pageStyles.helpList}>
          <li>
            Use the search box to find an image. Search by product name,
            brand name, label, or SKU. The list filters as you type.
          </li>
          <li>
            For the row you want to change, click <strong>Choose File</strong>{" "}
            and pick a new image from your computer.
          </li>
          <li>
            A blue preview shows the new image. If it&apos;s wrong, click{" "}
            <strong>Cancel</strong> and pick a different file.
          </li>
          <li>
            Click <strong>Replace</strong>. When you see{" "}
            <em>“Saved. Live on the site.”</em>, the change is live —
            refresh the public site to see it.
          </li>
        </ol>
        <p style={pageStyles.helpNote}>
          Notes: maximum file size is 10 MB. JPG, PNG, WebP, GIF, and SVG
          all work. There is no undo, but the previous file stays in Supabase
          Storage so it can be re-pasted into the URL column from the
          Supabase Dashboard if needed.
        </p>
      </details>

      <p style={pageStyles.summaryLine}>
        Managing <strong>{totalImages}</strong> images across{" "}
        <strong>{siteImages.length}</strong> site images,{" "}
        <strong>{brands.length}</strong> brand logos,{" "}
        <strong>{heroSlides.length}</strong> hero slides, and{" "}
        <strong>{productGroups.length}</strong> products.
      </p>

      {errors.length > 0 ? (
        <div style={pageStyles.error}>
          <strong>Some queries failed:</strong>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
          <p>
            If the database is empty, run the migrations in
            <code> supabase/migrations/ </code> from the Supabase SQL Editor
            (0001 → 0002 → 0003) and refresh.
          </p>
        </div>
      ) : null}

      {totalImages === 0 && errors.length === 0 ? (
        <div style={pageStyles.error}>
          <strong>No data in any image table yet.</strong>
          <p>
            Apply the three SQL migrations in <code>supabase/migrations/</code>
            {" "}from the Supabase SQL Editor (0001 → 0002 → 0003) and refresh.
          </p>
        </div>
      ) : (
        <DashboardList
          siteImages={siteImages}
          brands={brands}
          heroSlides={heroSlides}
          productGroups={productGroups}
        />
      )}
    </main>
  )
}

const pageStyles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "32px 24px 64px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#111",
    background: "#fafafa",
    minHeight: "100vh",
  },
  h1: { fontSize: 28, fontWeight: 800, margin: "0 0 8px" },
  summaryLine: { color: "#444", marginBottom: 24, fontSize: 14 },
  help: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 6,
    padding: "12px 16px",
    marginBottom: 16,
  },
  helpSummary: {
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  },
  helpList: {
    margin: "12px 0 8px 24px",
    lineHeight: 1.55,
    color: "#333",
    fontSize: 14,
  },
  helpNote: {
    marginTop: 8,
    fontSize: 13,
    color: "#666",
    lineHeight: 1.5,
  },
  error: {
    background: "#fff5f5",
    border: "1px solid #f3c4c4",
    color: "#7a1818",
    padding: 16,
    borderRadius: 6,
    marginBottom: 24,
  },
}
