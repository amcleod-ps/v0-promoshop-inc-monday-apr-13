import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { adminGateEnabled } from "@/lib/admin-auth"
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
  genders: string[] | null
  sizes: string[] | null
  min_qty: number
  sort_order: number
  is_active: boolean
}

interface SiteImageRowRaw {
  key: string
  label: string
  url: string | null
  alt_text: string | null
}

interface BrandRowRaw {
  slug: string
  name: string
  description: string | null
  categories: string[] | null
  logo_url: string | null
  featured: boolean
  sort_order: number
  is_active: boolean
}

interface HeroSlideRowRaw {
  id: string
  title: string
  subtitle: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  bg_color: string | null
  sort_order: number
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
  sort_order: number
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

// PostgREST caps responses at 1000 rows regardless of the requested limit,
// and product_images is already big enough to hit that in production. Page
// through with .range() so large tables load fully. The query factory must
// apply a deterministic ORDER BY (ties broken by a unique column) or rows
// can repeat/vanish across page boundaries.
const FETCH_PAGE_SIZE = 1000

interface QueryResult<T> {
  data: T[] | null
  error: { message: string } | null
}

async function fetchAll<T>(
  makeQuery: (from: number, to: number) => PromiseLike<QueryResult<T>>,
): Promise<QueryResult<T>> {
  const all: T[] = []
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + FETCH_PAGE_SIZE - 1)
    if (error) return { data: null, error }
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < FETCH_PAGE_SIZE) break
  }
  return { data: all, error: null }
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
    fetchAll((from, to) =>
      supabase
        .from("site_images")
        .select("key, label, url, alt_text")
        .order("label", { ascending: true })
        .order("key", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("brands")
        .select("slug, name, description, categories, logo_url, featured, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("slug", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("hero_slides")
        .select("id, title, subtitle, cta_text, cta_url, image_url, bg_color, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("product_images")
        .select("id, label, url, sort_order, product_sku, colour_id, products(name)")
        .order("product_sku", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("sku, name, category, description, brand_slugs, genders, sizes, min_qty, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("sku", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("product_colours")
        .select("id, product_sku, name, hex, sort_order")
        .order("product_sku", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("site_content")
        .select("key, label, value")
        .order("key", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("team_members")
        .select("slug, name, role, description, image_url, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("slug", { ascending: true })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("site_theme")
        .select("key, label, value")
        .order("key", { ascending: true })
        .range(from, to),
    ),
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

  const allSiteImages = (siteImagesRes.data as SiteImageRowRaw[] | null) ?? []
  const brands = (brandsRes.data as BrandRowRaw[] | null) ?? []
  const heroSlides = (heroSlidesRes.data as HeroSlideRowRaw[] | null) ?? []
  const productImages = (productImagesRes.data as ProductImageJoinedRow[] | null) ?? []
  const productRowsRaw = (productsRes.data as ProductFullRow[] | null) ?? []
  const productColours = (productColoursRes.data as ProductColourRow[] | null) ?? []
  const siteContentRaw = (siteContentRes.data as SiteContentRow[] | null) ?? []
  const teamRaw = (teamRes.data as TeamMemberRowRaw[] | null) ?? []
  const themeRaw = (themeRes.data as SiteThemeRowRaw[] | null) ?? []

  // Once team_members has rows (migration 0005), the public site reads the
  // roster exclusively from that table: the site_images `team.<slug>` slots
  // and the site_content `team.<slug>.*` overrides are dead inputs. Hide
  // them so admins aren't offered editors that save successfully but change
  // nothing — the Team tab is the live editor.
  const teamTableLive = !teamMissing && teamRaw.length > 0

  // Brand logos must always be edited through the Brand logos section
  // (target="brand"), which writes BOTH brands.logo_url and the legacy
  // site_images override. Listing the raw `brand.<slug>.logo` rows here too
  // let admins update only the override, silently desyncing the two stores.
  const siteImages = allSiteImages.filter((row) => {
    if (/^brand\..+\.logo$/.test(row.key)) return false
    if (teamTableLive && /^team\./.test(row.key)) return false
    return true
  })

  const filteredSiteContentRaw = teamTableLive
    ? siteContentRaw.filter(
        (row) => !/^team\./.test(row.key) || row.key.startsWith("team.section."),
      )
    : siteContentRaw

  // Soft-deleted products keep their product_images rows (so re-activating
  // from the Table Editor restores the gallery), but the dashboard must not
  // offer image editors for products that no longer exist on the public
  // site — admins read that as "I deleted it but it's still here".
  const activeSkus = new Set(productRowsRaw.map((p) => p.sku))
  const activeProductImages = productImages.filter((img) =>
    activeSkus.has(img.product_sku),
  )

  // ---- Images grouped by product (existing dashboard image view) ----------
  const productGroupMap = new Map<string, ProductGroup>()
  for (const img of activeProductImages) {
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
  for (const img of activeProductImages) {
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
      genders: p.genders ?? [],
      sizes: p.sizes ?? [],
      min_qty: p.min_qty,
      sort_order: p.sort_order,
      colours,
    }
  })

  // ---- Site text rows for the existing Text content tab -------------------
  const siteContent: SiteContentEntry[] = filteredSiteContentRaw
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
    sort_order: t.sort_order,
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
  // "Managing N text fields" counts populated values, not editor slots, so
  // the summary reflects actual content. Per slide the editable strings are
  // title, subtitle, CTA text, CTA URL, and bg colour; per brand they are
  // name, description, and the categories list. Display-order rows always
  // hold a value, so each row contributes its +1 unconditionally.
  const populated = (values: Array<string | null | undefined>) =>
    values.filter((v) => typeof v === "string" && v.trim() !== "").length
  const totalText =
    siteContent.length +
    heroSlides.reduce(
      (n, s) =>
        n + populated([s.title, s.subtitle, s.cta_text, s.cta_url, s.bg_color]) + 1,
      0,
    ) +
    brands.reduce(
      (n, b) =>
        n +
        populated([b.name, b.description]) +
        ((b.categories?.length ?? 0) > 0 ? 1 : 0) +
        1,
      0,
    )

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
          Limits: 10 MB max per image upload (JPG, PNG, WebP, GIF, or AVIF —
          SVG is blocked for security). 5,000 characters max per text field.{" "}
          {adminGateEnabled()
            ? "This dashboard is protected by the admin password (the browser sign-in prompt)."
            : "The dashboard has no access control — anyone with this URL can edit everything here, so treat the URL as the secret."}
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
            the Supabase SQL Editor, in order (0001 → 0007), and refresh.
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
