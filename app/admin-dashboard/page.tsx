import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  DashboardList,
  type ProductGroup,
  type SiteContentEntry,
} from "./dashboard-list"
import type { ProductRow } from "./products-tab"
import type { TeamMemberRow } from "./team-tab"
import type { ThemeEntry } from "./theme-tab"
import { DEFAULT_THEME } from "@/lib/supabase/theme"

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
  colour_id: string | null
  products: { name: string } | { name: string }[] | null
}

interface ProductColourRow {
  id: string
  product_sku: string
  name: string
  hex: string
  sort_order: number
}

interface ProductFullRow {
  sku: string
  name: string
  category: string
  description: string | null
  brand_slugs: string[] | null
  is_active: boolean
}

interface SiteContentRow {
  key: string
  label: string
  value: string
}

interface SiteThemeRowRaw {
  key: string
  label: string
  value: string
}

interface TeamMemberRowRaw {
  slug: string
  name: string
  role: string
  description: string | null
  image_url: string | null
  is_active: boolean
}

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

function missingTableError(err: { message?: string } | null | undefined): boolean {
  if (!err?.message) return false
  return (
    err.message.includes("does not exist") ||
    err.message.includes("schema cache") ||
    err.message.includes("Could not find the table")
  )
}

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
    productsRes,
    productColoursRes,
    siteContentRes,
    teamRes,
    themeRes,
  ] = await Promise.all([
    supabase
      .from("site_images")
      .select("key, label, url, alt_text")
      .order("label", { ascending: true }),
    supabase
      .from("brands")
      .select("slug, name, description, logo_url, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("hero_slides")
      .select("id, title, subtitle, cta_text, cta_url, image_url, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_images")
      .select("id, label, url, sort_order, product_sku, colour_id, products(name)")
      .order("product_sku", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("sku, name, category, description, brand_slugs, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_colours")
      .select("id, product_sku, name, hex, sort_order")
      .order("product_sku", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("site_content")
      .select("key, label, value")
      .order("key", { ascending: true }),
    supabase
      .from("team_members")
      .select("slug, name, role, description, image_url, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("site_theme").select("key, label, value"),
  ])

  const siteContentMissing = missingTableError(siteContentRes.error)
  const teamMissing = missingTableError(teamRes.error)
  const themeMissing = missingTableError(themeRes.error)

  const errors = [
    siteImagesRes.error,
    brandsRes.error,
    heroSlidesRes.error,
    productImagesRes.error,
    productsRes.error,
    productColoursRes.error,
    siteContentMissing ? null : siteContentRes.error,
    teamMissing ? null : teamRes.error,
    themeMissing ? null : themeRes.error,
  ].filter(Boolean) as Array<{ message: string }>

  const siteImages = siteImagesRes.data ?? []
  const brands = brandsRes.data ?? []
  const heroSlides = heroSlidesRes.data ?? []
  const productImages = (productImagesRes.data as ProductImageJoinedRow[] | null) ?? []
  const productRowsRaw = (productsRes.data as ProductFullRow[] | null) ?? []
  const productColours = (productColoursRes.data as ProductColourRow[] | null) ?? []
  const siteContentRaw = (siteContentRes.data as SiteContentRow[] | null) ?? []
  const teamRaw = (teamRes.data as TeamMemberRowRaw[] | null) ?? []
  const themeRaw = (themeRes.data as SiteThemeRowRaw[] | null) ?? []

  // ---- Images grouped by product (existing dashboard image view) ----------
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

  // ---- Full products structure for the new Products tab -------------------
  const coloursBySku = new Map<string, ProductColourRow[]>()
  for (const c of productColours) {
    const list = coloursBySku.get(c.product_sku) ?? []
    list.push(c)
    coloursBySku.set(c.product_sku, list)
  }
  const imagesByColour = new Map<string, ProductImageJoinedRow[]>()
  for (const img of productImages) {
    if (!img.colour_id) continue
    const list = imagesByColour.get(img.colour_id) ?? []
    list.push(img)
    imagesByColour.set(img.colour_id, list)
  }

  const productRows: ProductRow[] = productRowsRaw.map((p) => {
    const colours = (coloursBySku.get(p.sku) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
        sort_order: c.sort_order,
        images: (imagesByColour.get(c.id) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((img) => ({
            id: img.id,
            label: img.label,
            url: img.url,
            sort_order: img.sort_order,
          })),
      }))
    return {
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: p.description,
      brand_slugs: p.brand_slugs ?? [],
      colours,
    }
  })

  // Categories appearing on existing products — fed to the Add Product
  // form's <datalist> so admins picking a category for a new SKU don't
  // typo-fork the value ("Drinkware" vs "drinkware" would otherwise
  // create two filters on the public site).
  const productCategories = Array.from(
    new Set(productRows.map((p) => p.category.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  // ---- Site text rows for the existing Text content tab -------------------
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

  const team: TeamMemberRow[] = teamRaw.map((t) => ({
    slug: t.slug,
    name: t.name,
    role: t.role,
    description: t.description,
    image_url: t.image_url,
  }))

  const themeMap = new Map<string, SiteThemeRowRaw>()
  for (const t of themeRaw) themeMap.set(t.key, t)
  const theme: ThemeEntry[] = Object.entries(DEFAULT_THEME).map(([key, def]) => {
    const row = themeMap.get(key)
    return {
      key,
      label: row?.label ?? def.label,
      value: row?.value ?? def.value,
    }
  })

  const totalImages =
    siteImages.length +
    brands.length +
    heroSlides.length +
    productGroups.reduce((n, g) => n + g.images.length, 0)
  const totalText = siteContent.length + heroSlides.length * 4 + brands.length * 2

  const missingMigrations: string[] = []
  if (siteContentMissing) missingMigrations.push("0004_site_content.sql")
  if (teamMissing || themeMissing) missingMigrations.push("0005_team_and_theme.sql")

  return (
    <main style={pageStyles.main}>
      <h1 style={pageStyles.h1}>Image &amp; Content Dashboard</h1>

      <details style={pageStyles.help}>
        <summary style={pageStyles.helpSummary}>How to use this page</summary>
        <ol style={pageStyles.helpList}>
          <li>
            Pick a tab: <strong>Images</strong>, <strong>Text content</strong>,{" "}
            <strong>Products</strong>, <strong>Team</strong>, or <strong>Theme</strong>.
          </li>
          <li>
            Inside each tab, expand <strong>+ Add new …</strong> to create a new
            brand, hero slide, image slot, SKU, or team member.
          </li>
          <li>
            On any item: edit fields and click <strong>Save</strong>, replace an
            image with <strong>Replace</strong>, or click <strong>Remove</strong> /
            <strong> Delete</strong> to hide it from the public site. Deletes are
            soft — items can be re-activated in Supabase Table Editor.
          </li>
          <li>
            In the <strong>Theme</strong> tab, pick a new colour and click
            <strong> Save</strong>. The new value replaces the original hex
            everywhere on the site at the next page load.
          </li>
        </ol>
        <p style={pageStyles.helpNote}>
          Limits: 10 MB max per image upload (JPG, PNG, WebP, GIF, SVG). 5,000
          characters max per text field. The dashboard has no access control —
          anyone with this URL can edit everything here, so treat the URL as
          the secret.
        </p>
      </details>

      <p style={pageStyles.summaryLine}>
        Managing <strong>{totalImages}</strong> images,{" "}
        <strong>{totalText}</strong> text fields,{" "}
        <strong>{productRows.length}</strong> products, and{" "}
        <strong>{team.length}</strong> team members.
      </p>

      {missingMigrations.length > 0 ? (
        <div style={pageStyles.warning}>
          <strong>Migration{missingMigrations.length === 1 ? "" : "s"} not yet applied:</strong>
          <ul style={{ margin: "8px 0 8px 24px" }}>
            {missingMigrations.map((m) => (
              <li key={m}>
                <code>supabase/migrations/{m}</code>
              </li>
            ))}
          </ul>
          <p>
            Apply in the Supabase Dashboard → SQL Editor. Image editing, text
            editing, and existing tabs work without the new tables — only the
            sections backed by the missing tables are inert until you run
            them.
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
        </div>
      ) : null}

      {totalImages === 0 && errors.length === 0 ? (
        <div style={pageStyles.error}>
          <strong>No data in any image table yet.</strong>
          <p>
            Apply the SQL migrations in <code>supabase/migrations/</code> from
            the Supabase SQL Editor (0001 → 0002 → 0003 → 0004 → 0005) and
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
          productRows={productRows}
          productCategories={productCategories}
          team={team}
          theme={theme}
          teamTableMissing={teamMissing}
          themeTableMissing={themeMissing}
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
  helpSummary: { cursor: "pointer", fontWeight: 700, fontSize: 14 },
  helpList: {
    margin: "12px 0 8px 24px",
    lineHeight: 1.55,
    color: "#333",
    fontSize: 14,
  },
  helpNote: { marginTop: 8, fontSize: 13, color: "#666", lineHeight: 1.5 },
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
