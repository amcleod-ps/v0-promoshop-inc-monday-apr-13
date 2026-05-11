import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { ImageRow } from "./image-row"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Image Dashboard",
  robots: { index: false, follow: false },
}

interface SiteImageRow {
  key: string
  label: string
  url: string | null
  alt_text: string | null
}
interface BrandRow {
  slug: string
  name: string
  logo_url: string | null
  sort_order: number
}
interface HeroSlideRow {
  id: string
  title: string
  image_url: string | null
  sort_order: number
}
interface ProductImageRow {
  id: string
  label: string
  url: string | null
  sort_order: number
  product_sku: string
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
          <p>
            {err instanceof Error ? err.message : "Unknown error."}
          </p>
          <p>
            Add <code>SUPABASE_SERVICE_ROLE_KEY</code> to the Vercel project
            (Settings → Environment Variables) and redeploy. The value is the
            <em> service_role </em> secret on the Supabase Dashboard → Project
            Settings → API page. After saving it on Vercel, refresh this page.
          </p>
        </div>
      </main>
    )
  }

  const [siteImagesRes, brandsRes, heroSlidesRes, productImagesRes] = await Promise.all([
    supabase
      .from("site_images")
      .select("key, label, url, alt_text")
      .order("label", { ascending: true }),
    supabase
      .from("brands")
      .select("slug, name, logo_url, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("hero_slides")
      .select("id, title, image_url, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_images")
      .select("id, label, url, sort_order, product_sku")
      .order("product_sku", { ascending: true })
      .order("sort_order", { ascending: true }),
  ])

  const siteImages = (siteImagesRes.data as SiteImageRow[] | null) ?? []
  const brands = (brandsRes.data as BrandRow[] | null) ?? []
  const heroSlides = (heroSlidesRes.data as HeroSlideRow[] | null) ?? []
  const productImages = (productImagesRes.data as ProductImageRow[] | null) ?? []

  // Group product images by SKU for readability — there are ~250 of them.
  const productGroups = new Map<string, ProductImageRow[]>()
  for (const img of productImages) {
    const list = productGroups.get(img.product_sku) ?? []
    list.push(img)
    productGroups.set(img.product_sku, list)
  }

  const errors = [
    siteImagesRes.error,
    brandsRes.error,
    heroSlidesRes.error,
    productImagesRes.error,
  ].filter(Boolean) as Array<{ message: string }>

  return (
    <main style={pageStyles.main}>
      <h1 style={pageStyles.h1}>Image Dashboard</h1>
      <p style={pageStyles.intro}>
        Replace any image on the site. Pick a file, click <strong>Replace</strong>,
        and the change is live on the next page request. There is no undo —
        the previous file stays in Storage but the database row points at the
        new one.
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

      <Section
        title={`Site images (${siteImages.length})`}
        description="Logos, About-page hero, team photos, brand lifestyle backdrops, and other singleton images."
      >
        {siteImages.length === 0 ? (
          <Empty />
        ) : (
          siteImages.map((row) => (
            <ImageRow
              key={row.key}
              target="site_images"
              id={row.key}
              label={row.label}
              currentUrl={row.url}
              hint={row.alt_text}
            />
          ))
        )}
      </Section>

      <Section
        title={`Brand logos (${brands.length})`}
        description="Logo that appears in the homepage brand scroll and on every brand page."
      >
        {brands.length === 0 ? (
          <Empty />
        ) : (
          brands.map((row) => (
            <ImageRow
              key={row.slug}
              target="brand"
              id={row.slug}
              label={`Brand logo: ${row.name}`}
              currentUrl={row.logo_url}
            />
          ))
        )}
      </Section>

      <Section
        title={`Hero slides (${heroSlides.length})`}
        description="The slideshow images on the homepage."
      >
        {heroSlides.length === 0 ? (
          <Empty />
        ) : (
          heroSlides.map((row) => (
            <ImageRow
              key={row.id}
              target="hero_slide"
              id={row.id}
              label={row.title}
              currentUrl={row.image_url}
            />
          ))
        )}
      </Section>

      <Section
        title={`Product images (${productImages.length})`}
        description="Gallery images for every product, grouped by SKU. Each label includes the product name, colour, and image number."
      >
        {productImages.length === 0 ? (
          <Empty />
        ) : (
          Array.from(productGroups.entries()).map(([sku, imgs]) => (
            <details key={sku} style={pageStyles.details}>
              <summary style={pageStyles.summary}>
                <strong>{sku}</strong> — {imgs.length} image{imgs.length === 1 ? "" : "s"}
              </summary>
              <div style={pageStyles.detailsBody}>
                {imgs.map((img) => (
                  <ImageRow
                    key={img.id}
                    target="product_image"
                    id={img.id}
                    label={img.label}
                    currentUrl={img.url}
                  />
                ))}
              </div>
            </details>
          ))
        )}
      </Section>
    </main>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section style={pageStyles.section}>
      <h2 style={pageStyles.h2}>{title}</h2>
      <p style={pageStyles.sectionDescription}>{description}</p>
      <div style={pageStyles.list}>{children}</div>
    </section>
  )
}

function Empty() {
  return (
    <p style={{ color: "#666", fontStyle: "italic", padding: 12 }}>
      No rows in this table yet. Run the seed migration in Supabase.
    </p>
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
  intro: { color: "#444", marginBottom: 24, lineHeight: 1.5 },
  section: { marginBottom: 40 },
  h2: { fontSize: 20, fontWeight: 700, margin: "0 0 4px" },
  sectionDescription: { color: "#666", fontSize: 14, marginBottom: 14 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  error: {
    background: "#fff5f5",
    border: "1px solid #f3c4c4",
    color: "#7a1818",
    padding: 16,
    borderRadius: 6,
    marginBottom: 24,
  },
  details: {
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    padding: "8px 12px",
  },
  summary: { cursor: "pointer", padding: "4px 0", fontSize: 14 },
  detailsBody: { marginTop: 10, display: "flex", flexDirection: "column", gap: 10 },
}
