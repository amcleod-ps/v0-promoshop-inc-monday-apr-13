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
import { IMAGE_FIT_PREFIX } from "@/lib/image-fit"
import { IMAGE_SIZE_PREFIX } from "@/lib/image-size"
import { EXTRA_TEXT_SLOTS } from "@/lib/cms/text-slots"

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
  { prefix: "header.", group: "Header & navigation" },
  { prefix: "home.hero.body", group: "Home page", multiline: true },
  { prefix: "home.hero.cta", group: "Home page" },
  { prefix: "home.", group: "Home page" },
  { prefix: "studio.", group: "Studio page" },
  { prefix: "quote.success.body", group: "Quote builder", multiline: true },
  { prefix: "quote.", group: "Quote builder" },
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
  "Header & navigation",
  "Home page",
  "Studio page",
  "Quote builder",
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

  // Raw PostgREST/Postgres messages name tables, columns, and schema-cache
  // internals; log them server-side (Vercel function logs) and show the admin a
  // generic banner instead — the same masking adminActionError applies to the
  // write paths.
  if (errors.length > 0) {
    for (const e of errors) console.error("[admin-dashboard] data load error:", e.message)
  }

  const allSiteImages = (siteImagesRes.data as SiteImageRowRaw[] | null) ?? []
  const brands = (brandsRes.data as BrandRowRaw[] | null) ?? []
  const heroSlides = (heroSlidesRes.data as HeroSlideRowRaw[] | null) ?? []
  const productImages = (productImagesRes.data as ProductImageJoinedRow[] | null) ?? []
  const productRowsRaw = (productsRes.data as ProductFullRow[] | null) ?? []
  const productColours = (productColoursRes.data as ProductColourRow[] | null) ?? []
  const siteContentRaw = (siteContentRes.data as SiteContentRow[] | null) ?? []
  const teamRaw = (teamRes.data as TeamMemberRowRaw[] | null) ?? []
  const themeRaw = (themeRes.data as SiteThemeRowRaw[] | null) ?? []

  // Once migration 0005 is applied, the public site reads the roster
  // exclusively from team_members — an empty table means "no team", NOT "fall
  // back to the static roster" (see use-team-members.ts) — so the site_images
  // `team.<slug>` slots and site_content `team.<slug>.*` overrides are dead
  // inputs. Gate on the table EXISTING, not on it currently having active rows:
  // if the admin soft-deletes every member, teamRaw is empty but the table is
  // still the live source, and re-exposing those legacy editors would offer
  // saves that change nothing. The Team tab is the live editor.
  const teamTableLive = !teamMissing

  // Brand logos must always be edited through the Brand logos section
  // (target="brand"), which writes BOTH brands.logo_url and the legacy
  // site_images override. Listing the raw `brand.<slug>.logo` rows here too
  // let admins update only the override, silently desyncing the two stores.
  const activeBrandSlugs = new Set(brands.map((b) => b.slug))
  const siteImages = allSiteImages.filter((row) => {
    if (/^brand\..+\.logo$/.test(row.key)) return false
    // Drop the lifestyle backdrop slot of a soft-deleted brand: createBrand
    // provisions `brand.<slug>.lifestyle` for every brand, softDeleteBrand
    // leaves it behind, and /brands/<slug> 404s for inactive brands — so the
    // slot would be an editable no-op. Mirrors the activeSkus product filter.
    const lifestyle = /^brand\.(.+)\.lifestyle$/.exec(row.key)
    if (lifestyle && !activeBrandSlugs.has(lifestyle[1])) return false
    if (teamTableLive && /^team\./.test(row.key)) return false
    return true
  })

  // image-fit.* rows are display-mode settings with a dedicated selector on
  // the Images tab — listing them as raw text rows here would invite typos
  // that the selector's validation exists to prevent.
  const imageFits: Record<string, string> = {}
  const imageSizes: Record<string, string> = {}
  for (const row of siteContentRaw) {
    if (row.key.startsWith(IMAGE_FIT_PREFIX)) {
      imageFits[row.key.slice(IMAGE_FIT_PREFIX.length)] = row.value
    } else if (row.key.startsWith(IMAGE_SIZE_PREFIX)) {
      imageSizes[row.key.slice(IMAGE_SIZE_PREFIX.length)] = row.value
    }
  }
  // Both image-fit.* and image-size.* are display settings with dedicated
  // selectors on the Images tab — keep them out of the raw Text editors so a
  // typo can't bypass the selectors' validation.
  const textContentRaw = siteContentRaw.filter(
    (row) =>
      !row.key.startsWith(IMAGE_FIT_PREFIX) && !row.key.startsWith(IMAGE_SIZE_PREFIX),
  )

  const filteredSiteContentRaw = teamTableLive
    ? textContentRaw.filter(
        (row) => !/^team\./.test(row.key) || row.key.startsWith("team.section."),
      )
    : textContentRaw

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
  // DB rows first, then the compiled-in registry of editable slots that have
  // no row yet (lib/cms/text-slots.ts) — copy that used to be hard-coded.
  // Saving a registry slot upserts a real row; blank keeps the built-in text.
  const registrySlotByKey = new Map(EXTRA_TEXT_SLOTS.map((s) => [s.key, s]))
  const presentKeys = new Set(filteredSiteContentRaw.map((row) => row.key))
  const slotHint = (key: string): string | undefined => {
    const slot = registrySlotByKey.get(key)
    if (!slot) return undefined
    const preview =
      slot.fallback.length > 90 ? `${slot.fallback.slice(0, 90)}…` : slot.fallback
    return `Leave blank to keep the built-in text: “${preview}”`
  }
  const mergedContentRows = [
    ...filteredSiteContentRaw,
    ...EXTRA_TEXT_SLOTS.filter((slot) => !presentKeys.has(slot.key)).map((slot) => ({
      key: slot.key,
      label: slot.label,
      value: "",
    })),
  ]
  const siteContent: SiteContentEntry[] = mergedContentRows
    .map((row) => {
      const { group, multiline } = classifyContentKey(row.key)
      const slot = registrySlotByKey.get(row.key)
      return {
        key: row.key,
        label: row.label,
        value: row.value ?? "",
        group,
        multiline: slot?.multiline ?? multiline,
        hint: slotHint(row.key),
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
    <main className="psadmin" style={pageStyles.main}>
      {/* Dashboard-wide affordances that inline styles can't express:
          disabled buttons must LOOK disabled (Save sits greyed until a field
          is edited — admins read full-contrast disabled buttons as broken),
          keyboard focus must be visible, and images may never overflow
          their card on small screens. */}
      <style>{`
        .psadmin button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .psadmin button:focus-visible,
        .psadmin input:focus-visible,
        .psadmin select:focus-visible,
        .psadmin textarea:focus-visible,
        .psadmin summary:focus-visible,
        .psadmin a:focus-visible {
          outline: 2px solid #ef473f;
          outline-offset: 2px;
        }
        .psadmin img {
          max-width: 100%;
        }
        @media (max-width: 480px) {
          .psadmin {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
      `}</style>
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
            On any item: edit fields and click <strong>Save</strong> (it lights
            up once you change something), replace an image with{" "}
            <strong>Replace</strong>, or click <strong>Remove</strong> /
            <strong> Delete</strong> to hide it from the public site. Deletes are
            soft — items can be re-activated in Supabase Table Editor.
          </li>
          <li>
            Hero slides, the About-page hero, and brand lifestyle backdrops
            also offer an <strong>Image display</strong> choice: fill the frame
            (crops to fit) or show the whole image (no cropping) — use the
            second for logos and tall or wide artwork.
          </li>
          <li>
            Text fields left blank fall back to the site&apos;s built-in copy,
            shown in the field&apos;s hint.
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
          <strong>Some data failed to load.</strong>
          <p>
            {errors.length === 1 ? "A query" : `${errors.length} queries`} returned
            an error. The details were logged to the server (Vercel function
            logs). Refresh to retry; if it persists, check the Supabase project
            status and that the environment variables are set.
          </p>
        </div>
      ) : null}

      {totalImages === 0 && errors.length === 0 ? (
        <div style={pageStyles.error}>
          <strong>No data in any image table yet.</strong>
          <p>
            Apply the SQL migrations in <code>supabase/migrations/</code> from
            the Supabase SQL Editor, in order (0001 → 0008), and refresh.
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
          imageFits={imageFits}
          imageSizes={imageSizes}
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
