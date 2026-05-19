import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DashboardList,
  type ProductGroup,
  type SiteContentEntry,
} from "./dashboard-list"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Image & Content Dashboard",
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

interface SiteContentRow {
  key: string
  label: string
  value: string
}

// Maps each `site_content` key prefix to (a) the group it shows up under in
// the dashboard text editor and (b) whether the field is multi-line. The
// `key` column lives in Supabase, but this mapping is editorial / display
// metadata, so it stays in code.
const CONTENT_KEY_RULES: Array<{
  prefix: string
  group: string
  multiline?: boolean
}> = [
  { prefix: "home.hero.body", group: "Home page", multiline: true },
  { prefix: "home.hero.cta", group: "Home page" },
  { prefix: "home.", group: "Home page" },
  { prefix: "about.hero.eyebrow", group: "About page" },
  { prefix: "about.hero.heading", group: "About page" },
  { prefix: "about.hero.body", group: "About page", multiline: true },
  { prefix: "about.", group: "About page" },
  { prefix: "team.section.", group: "Team section" },
  { prefix: "team.", group: "Team members" },
  { prefix: "brands.cta.body", group: "Brands page", multiline: true },
  { prefix: "brands.page.body", group: "Brands page", multiline: true },
  { prefix: "brands.", group: "Brands page" },
  { prefix: "contact.section.subheading", group: "Contact section", multiline: true },
  { prefix: "contact.", group: "Contact section" },
  { prefix: "footer.ada", group: "Footer", multiline: true },
  { prefix: "footer.tagline", group: "Footer", multiline: true },
  { prefix: "footer.", group: "Footer" },
]

function classifyContentKey(key: string): { group: string; multiline: boolean } {
  for (const rule of CONTENT_KEY_RULES) {
    if (key.startsWith(rule.prefix)) {
      return { group: rule.group, multiline: rule.multiline ?? false }
    }
  }
  return { group: "Other", multiline: false }
}

const CONTENT_GROUP_ORDER = [
  "Home page",
  "About page",
  "Team section",
  "Team members",
  "Brands page",
  "Contact section",
  "Footer",
  "Other",
]

export default async function AdminDashboardPage() {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    return (
      <main style={pageStyles.main}>
        <h1 style={pageStyles.h1}>Image &amp; Content Dashboard</h1>
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

  const [
    siteImagesRes,
    brandsRes,
    heroSlidesRes,
    productImagesRes,
    siteContentRes,
  ] = await Promise.all([
    supabase
      .from("site_images")
      .select("key, label, url, alt_text")
      .order("label", { ascending: true }),
    supabase
      .from("brands")
      .select("slug, name, description, logo_url")
      .order("sort_order", { ascending: true }),
    supabase
      .from("hero_slides")
      .select("id, title, subtitle, cta_text, cta_url, image_url, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_images")
      .select(
        "id, label, url, sort_order, product_sku, products(name)",
      )
      .order("product_sku", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("site_content")
      .select("key, label, value")
      .order("key", { ascending: true }),
  ])

  // Filter out missing-table errors for site_content specifically — that's
  // the expected state until migration 0004 is applied. We still want to
  // surface other errors so the maintainer can debug them.
  const siteContentMissing =
    siteContentRes.error?.message?.includes("does not exist") ||
    siteContentRes.error?.message?.includes("site_content") ||
    false

  const errors = [
    siteImagesRes.error,
    brandsRes.error,
    heroSlidesRes.error,
    productImagesRes.error,
    siteContentMissing ? null : siteContentRes.error,
  ].filter(Boolean) as Array<{ message: string }>

  const siteImages = siteImagesRes.data ?? []
  const brands = brandsRes.data ?? []
  const heroSlides = heroSlidesRes.data ?? []
  const productImages = (productImagesRes.data as ProductImageJoinedRow[] | null) ?? []
  const siteContentRaw = (siteContentRes.data as SiteContentRow[] | null) ?? []

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

  const siteContent: SiteContentEntry[] = siteContentRaw
    .map((row) => {
      const { group, multiline } = classifyContentKey(row.key)
      return {
        key: row.key,
        label: row.label,
        value: row.value ?? "",
        group,
        multiline,
      }
    })
    .sort((a, b) => {
      const aGroup = CONTENT_GROUP_ORDER.indexOf(a.group)
      const bGroup = CONTENT_GROUP_ORDER.indexOf(b.group)
      if (aGroup !== bGroup) return aGroup - bGroup
      return a.key.localeCompare(b.key)
    })

  const totalImages =
    siteImages.length +
    brands.length +
    heroSlides.length +
    productGroups.reduce((n, g) => n + g.images.length, 0)
  const totalText = siteContent.length + heroSlides.length * 4 + brands.length * 2

  return (
    <main style={pageStyles.main}>
      <h1 style={pageStyles.h1}>Image &amp; Content Dashboard</h1>

      <details style={pageStyles.help}>
        <summary style={pageStyles.helpSummary}>
          How to use this page
        </summary>
        <ol style={pageStyles.helpList}>
          <li>
            Pick a tab: <strong>Images</strong> to replace or remove pictures,
            or <strong>Text content</strong> to edit headings, paragraphs, and
            button labels.
          </li>
          <li>
            Use the search box to find the row you want. Search matches the
            label, the database key, and (for text) the current value.
          </li>
          <li>
            On an <em>image</em> row: click <strong>Choose File</strong>, pick
            an image, then <strong>Replace</strong>. Click <strong>Remove</strong>{" "}
            to delete the current image — the row stays and shows the default.
          </li>
          <li>
            On a <em>text</em> row: edit the value and click <strong>Save</strong>.
            When you see <em>“Saved. Live on the site.”</em>, refresh the
            public site to see the change.
          </li>
        </ol>
        <p style={pageStyles.helpNote}>
          Notes: maximum file size is 10 MB; JPG, PNG, WebP, GIF, and SVG all
          work. Maximum text length is 5,000 characters per field. The
          dashboard has no access control — anyone with the URL can edit
          everything here, so treat the URL as the secret.
        </p>
      </details>

      <p style={pageStyles.summaryLine}>
        Managing <strong>{totalImages}</strong> images and{" "}
        <strong>{totalText}</strong> editable text fields across the site.
      </p>

      {siteContentMissing ? (
        <div style={pageStyles.warning}>
          <strong>Text editor migration not yet applied.</strong>
          <p>
            The text-editing tab works once you run the latest migration. In
            the Supabase Dashboard → SQL Editor, paste the contents of{" "}
            <code>supabase/migrations/0004_site_content.sql</code> and click
            Run. Refresh this page afterwards. Image editing is unaffected.
          </p>
        </div>
      ) : null}

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
            (0001 → 0002 → 0003 → 0004) and refresh.
          </p>
        </div>
      ) : null}

      {totalImages === 0 && errors.length === 0 ? (
        <div style={pageStyles.error}>
          <strong>No data in any image table yet.</strong>
          <p>
            Apply the SQL migrations in <code>supabase/migrations/</code>{" "}
            from the Supabase SQL Editor (0001 → 0002 → 0003 → 0004) and
            refresh.
          </p>
        </div>
      ) : (
        <DashboardList
          siteImages={siteImages}
          brands={brands}
          heroSlides={heroSlides}
          productGroups={productGroups}
          siteContent={siteContent}
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
  warning: {
    background: "#fffaf0",
    border: "1px solid #f0c060",
    color: "#73510a",
    padding: 16,
    borderRadius: 6,
    marginBottom: 24,
  },
}
