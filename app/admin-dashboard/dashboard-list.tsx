"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { ImageRow } from "./image-row"
import { TextRow } from "./text-row"
import {
  AddBrandForm,
  AddHeroSlideForm,
  AddSiteImageForm,
} from "./create-forms"
import { ProductsTab, type ProductRow } from "./products-tab"
import { TeamTab, type TeamMemberRow } from "./team-tab"
import { ThemeTab, type ThemeEntry } from "./theme-tab"
import {
  softDeleteBrand,
  softDeleteHeroSlide,
  deleteSiteImage,
  updateBrandCategories,
  updateBrandFeatured,
  updateHeroSlideBgColor,
  updateSiteImageAltText,
  updateSortOrder,
} from "./create-actions"
import { parseRequiredNumber } from "./parse-required-number"

interface SiteImageRow {
  key: string
  label: string
  url: string | null
  alt_text: string | null
}
interface BrandRow {
  slug: string
  name: string
  description: string | null
  categories: string[] | null
  logo_url: string | null
  featured: boolean
  sort_order: number
}
interface HeroSlideRow {
  id: string
  title: string
  subtitle: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  bg_color: string | null
  sort_order: number
}
interface ProductImageRow {
  id: string
  label: string
  url: string | null
  product_sku: string
}
export interface ProductGroup {
  sku: string
  name: string
  images: ProductImageRow[]
}
export interface SiteContentEntry {
  key: string
  label: string
  value: string
  group: string
  multiline: boolean
  /** Editor hint — used for registry-backed slots to show the built-in
   *  default copy a blank value falls back to. */
  hint?: string
}

interface Props {
  siteImages: SiteImageRow[]
  brands: BrandRow[]
  heroSlides: HeroSlideRow[]
  productGroups: ProductGroup[]
  siteContent: SiteContentEntry[]
  productRows: ProductRow[]
  team: TeamMemberRow[]
  theme: ThemeEntry[]
  teamTableMissing: boolean
  themeTableMissing: boolean
  /** Current cover/contain choice per fit slot (see lib/image-fit.ts),
   *  keyed by slot (`hero_slide.<id>`, `about.hero`, …). */
  imageFits: Record<string, string>
  /** Current sm/md/lg display-size choice per size slot (see
   *  lib/image-size.ts), keyed by slot (`site.logo`). */
  imageSizes: Record<string, string>
}

type Tab = "images" | "text" | "products" | "team" | "theme"

export function DashboardList({
  siteImages,
  brands,
  heroSlides,
  productGroups,
  siteContent,
  productRows,
  team,
  theme,
  teamTableMissing,
  themeTableMissing,
  imageFits,
  imageSizes,
}: Props) {
  const [tab, setTab] = useState<Tab>("images")
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()

  const match = useCallback(
    (text: string | null | undefined) =>
      !needle || (text ?? "").toLowerCase().includes(needle),
    [needle],
  )

  // ----- images -----
  const filteredSiteImages = useMemo(
    () =>
      siteImages.filter(
        (i) => match(i.label) || match(i.key) || match(i.alt_text),
      ),
    [siteImages, match],
  )
  const filteredBrandImages = useMemo(
    () => brands.filter((b) => match(`Brand logo: ${b.name}`) || match(b.slug)),
    [brands, match],
  )
  const filteredHeroSlides = useMemo(
    () => heroSlides.filter((s) => match(s.title)),
    [heroSlides, match],
  )
  const filteredProductGroups = useMemo(() => {
    if (!needle) return productGroups
    return productGroups
      .map((g) => {
        const skuOrNameMatch = match(g.sku) || match(g.name)
        return {
          ...g,
          images: skuOrNameMatch
            ? g.images
            : g.images.filter((img) => match(img.label)),
        }
      })
      .filter((g) => g.images.length > 0)
  }, [productGroups, needle, match])

  const totalImagesFiltered =
    filteredSiteImages.length +
    filteredBrandImages.length +
    filteredHeroSlides.length +
    filteredProductGroups.reduce((n, g) => n + g.images.length, 0)

  // ----- text -----
  const filteredContent = useMemo(
    () =>
      siteContent.filter(
        (c) => match(c.label) || match(c.key) || match(c.value),
      ),
    [siteContent, match],
  )
  const contentByGroup = useMemo(() => {
    const groups = new Map<string, SiteContentEntry[]>()
    for (const entry of filteredContent) {
      const list = groups.get(entry.group) ?? []
      list.push(entry)
      groups.set(entry.group, list)
    }
    return groups
  }, [filteredContent])

  const filteredHeroSlidesText = useMemo(
    () =>
      heroSlides.filter(
        (s) =>
          match(s.title) ||
          match(s.subtitle) ||
          match(s.cta_text) ||
          match(s.cta_url),
      ),
    [heroSlides, match],
  )
  const filteredBrandsText = useMemo(
    () =>
      brands.filter(
        (b) =>
          match(b.name) ||
          match(b.slug) ||
          match(b.description) ||
          match((b.categories ?? []).join(" ")),
      ),
    [brands, match],
  )

  const totalTextFiltered =
    filteredContent.length +
    filteredHeroSlidesText.length * 6 +
    filteredBrandsText.length * 4

  const showSearch = tab === "images" || tab === "text"
  const matchCountForTab =
    tab === "images" ? totalImagesFiltered : tab === "text" ? totalTextFiltered : 0

  return (
    <>
      <div style={styles.tabs} role="tablist" aria-label="Dashboard sections">
        <TabButton tabKey="images" label="Images" active={tab === "images"} onClick={() => setTab("images")} />
        <TabButton tabKey="text" label="Text content" active={tab === "text"} onClick={() => setTab("text")} />
        <TabButton tabKey="products" label="Products" active={tab === "products"} onClick={() => setTab("products")} />
        <TabButton tabKey="team" label="Team" active={tab === "team"} onClick={() => setTab("team")} />
        <TabButton tabKey="theme" label="Theme" active={tab === "theme"} onClick={() => setTab("theme")} />
      </div>

      {showSearch ? (
        <div style={styles.searchWrap}>
          <input
            type="text"
            aria-label={tab === "images" ? "Search images" : "Search text content"}
            placeholder={
              tab === "images"
                ? "Search images by name, SKU, or label…"
                : "Search text by heading, key, or current value…"
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={styles.search}
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} style={styles.clearButton}>
              Clear
            </button>
          ) : null}
          {q ? (
            <span style={styles.matchCount}>
              {matchCountForTab} match{matchCountForTab === 1 ? "" : "es"}
            </span>
          ) : null}
        </div>
      ) : null}

      {tab === "images" ? (
        <div role="tabpanel" id="panel-images" aria-labelledby="tab-images">
          <Section
            title={`Site images${needle ? ` (${filteredSiteImages.length})` : ` (${siteImages.length})`}`}
            description="Site logo, About-page hero, and brand lifestyle backdrops. Brand logos live in the next section (so both stores stay in sync) and team photos are edited on the Team tab."
            hidden={!!needle && filteredSiteImages.length === 0}
          >
            {!needle ? <AddSiteImageForm /> : null}
            {filteredSiteImages.map((row) => (
              <SiteImageRowWithDelete
                key={row.key}
                row={row}
                imageFits={imageFits}
                imageSizes={imageSizes}
              />
            ))}
          </Section>

          <Section
            title={`Brand logos${needle ? ` (${filteredBrandImages.length})` : ` (${brands.length})`}`}
            description="One per brand. Used on the homepage scroll and every brand detail page."
            hidden={!!needle && filteredBrandImages.length === 0}
          >
            {!needle ? <AddBrandForm /> : null}
            {filteredBrandImages.map((row) => (
              <ImageRow
                key={row.slug}
                target="brand"
                id={row.slug}
                label={`Brand logo: ${row.name}`}
                currentUrl={row.logo_url}
              />
            ))}
          </Section>

          <Section
            title={`Hero slides${needle ? ` (${filteredHeroSlides.length})` : ` (${heroSlides.length})`}`}
            description="The slideshow on the homepage. Edit the slide text on the Text content tab."
            hidden={!!needle && filteredHeroSlides.length === 0}
          >
            {!needle ? <AddHeroSlideForm /> : null}
            {filteredHeroSlides.map((row) => (
              <ImageRow
                key={row.id}
                target="hero_slide"
                id={row.id}
                label={row.title}
                currentUrl={row.image_url}
                fitSlot={`hero_slide.${row.id}`}
                currentFit={imageFits[`hero_slide.${row.id}`]}
              />
            ))}
          </Section>

          <Section
            title={`Product images${needle ? ` (${filteredProductGroups.reduce((n, g) => n + g.images.length, 0)})` : ` (${productGroups.reduce((n, g) => n + g.images.length, 0)})`}`}
            description="Gallery imagery for every product, grouped by SKU. To add a new product or attach images to a colour, use the Products tab."
            hidden={!!needle && filteredProductGroups.length === 0}
          >
            {filteredProductGroups.map((g) => (
              <details
                key={g.sku}
                open={!!needle}
                style={styles.details}
              >
                <summary style={styles.summary}>
                  <strong>{g.sku}</strong> · {g.name} · {g.images.length} image
                  {g.images.length === 1 ? "" : "s"}
                </summary>
                <div style={styles.detailsBody}>
                  {g.images.map((img) => (
                    <ImageRow
                      key={img.id}
                      target="product_image"
                      id={img.id}
                      label={img.label}
                      currentUrl={img.url}
                      hint={g.name}
                    />
                  ))}
                </div>
              </details>
            ))}
          </Section>

          {needle && totalImagesFiltered === 0 ? (
            <p style={styles.noMatches}>
              No images match <strong>“{q}”</strong>. Try a different search term,
              or click <em>Clear</em> to show everything.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "text" ? (
        <div role="tabpanel" id="panel-text" aria-labelledby="tab-text">
          {Array.from(contentByGroup.entries()).map(([group, entries]) => (
            <Section
              key={group}
              title={`${group}${needle ? ` (${entries.length})` : ""}`}
              description={describeContentGroup(group)}
              hidden={false}
            >
              {entries.map((entry) => (
                <TextRow
                  key={entry.key}
                  source="site_content"
                  contentKey={entry.key}
                  contentLabel={entry.label}
                  label={entry.label}
                  hint={entry.hint}
                  currentValue={entry.value}
                  multiline={entry.multiline}
                />
              ))}
            </Section>
          ))}

          <Section
            title={`Hero slides${needle ? ` (${filteredHeroSlidesText.length})` : ` (${heroSlides.length})`}`}
            description="Editable text for every slide in the homepage slideshow. The subtitle and CTA button render as an overlay on the slide; leave subtitle, CTA label, and CTA URL blank for a clean image-only slide."
            hidden={!!needle && filteredHeroSlidesText.length === 0}
          >
            {!needle ? <AddHeroSlideForm /> : null}
            {filteredHeroSlidesText.map((slide) => (
              <details
                key={slide.id}
                open={!!needle || heroSlides.length <= 4}
                style={styles.details}
              >
                <summary style={styles.summary}>
                  <strong>{slide.title || "(untitled slide)"}</strong>
                </summary>
                <div style={styles.detailsBody}>
                  <TextRow
                    source="hero_slide"
                    slideId={slide.id}
                    field="title"
                    label="Slide title"
                    hint="Used as the image's alt text and as this list's label — not displayed on the slide."
                    currentValue={slide.title}
                  />
                  <TextRow
                    source="hero_slide"
                    slideId={slide.id}
                    field="subtitle"
                    label="Slide subtitle (shown on the slide)"
                    currentValue={slide.subtitle ?? ""}
                    multiline
                  />
                  <TextRow
                    source="hero_slide"
                    slideId={slide.id}
                    field="cta_text"
                    label="CTA button text"
                    currentValue={slide.cta_text ?? ""}
                  />
                  <TextRow
                    source="hero_slide"
                    slideId={slide.id}
                    field="cta_url"
                    label="CTA destination URL"
                    hint="Must start with / (page on this site) or http(s):// (external link)."
                    currentValue={slide.cta_url ?? ""}
                  />
                  <TextRow
                    source="custom"
                    idLabel={`hero_slide:${slide.id}:bg_color`}
                    label="Background colour (hex like #ef473f; blank for none)"
                    hint="Shows behind/instead of the image. Slides with neither an image nor a background colour are skipped by the slideshow."
                    currentValue={slide.bg_color ?? ""}
                    onSave={(v) => updateHeroSlideBgColor(slide.id, v)}
                  />
                  <TextRow
                    source="custom"
                    idLabel={`hero_slide:${slide.id}:sort_order`}
                    label="Display order (lower shows first)"
                    currentValue={String(slide.sort_order)}
                    onSave={(v) => updateSortOrder("hero_slide", slide.id, parseRequiredNumber(v))}
                  />
                  <DeleteEntityButton
                    label={`Remove slide "${slide.title || "(untitled)"}" from the homepage`}
                    confirmMessage={`Remove slide "${slide.title || "(untitled)"}" from the homepage?`}
                    onDelete={() => softDeleteHeroSlide(slide.id)}
                  />
                </div>
              </details>
            ))}
          </Section>

          <Section
            title={`Brand text${needle ? ` (${filteredBrandsText.length})` : ` (${brands.length})`}`}
            description="Name and description shown on the brands listing and per-brand pages."
            hidden={!!needle && filteredBrandsText.length === 0}
          >
            {!needle ? <AddBrandForm /> : null}
            {filteredBrandsText.map((brand) => (
              <details
                key={brand.slug}
                open={!!needle}
                style={styles.details}
              >
                <summary style={styles.summary}>
                  <strong>{brand.name}</strong>{" "}
                  <span style={styles.summaryAside}>· {brand.slug}</span>
                </summary>
                <div style={styles.detailsBody}>
                  <TextRow
                    source="brand"
                    brandSlug={brand.slug}
                    field="name"
                    label="Brand name"
                    currentValue={brand.name}
                  />
                  <TextRow
                    source="brand"
                    brandSlug={brand.slug}
                    field="description"
                    label="Brand description"
                    currentValue={brand.description ?? ""}
                    multiline
                  />
                  <TextRow
                    source="custom"
                    idLabel={`brand:${brand.slug}:categories`}
                    label="Categories (comma-separated)"
                    hint="Shown as tags on the brands listing and the brand page."
                    currentValue={(brand.categories ?? []).join(", ")}
                    onSave={(v) =>
                      updateBrandCategories(
                        brand.slug,
                        v.split(",").map((c) => c.trim()).filter(Boolean),
                      )
                    }
                  />
                  <BrandFeaturedToggle slug={brand.slug} initial={brand.featured} />
                  <TextRow
                    source="custom"
                    idLabel={`brand:${brand.slug}:sort_order`}
                    label="Display order (lower shows first)"
                    currentValue={String(brand.sort_order)}
                    onSave={(v) => updateSortOrder("brand", brand.slug, parseRequiredNumber(v))}
                  />
                  <DeleteEntityButton
                    label={`Remove brand "${brand.name}" from the public site`}
                    confirmMessage={`Remove brand "${brand.name}"? It will disappear from the brands listing and logo scroll. Products tagged with this brand stay in the catalog, but will show a derived brand label until you reassign or rename them.`}
                    onDelete={() => softDeleteBrand(brand.slug)}
                  />
                </div>
              </details>
            ))}
          </Section>

          {needle && totalTextFiltered === 0 ? (
            <p style={styles.noMatches}>
              No text matches <strong>“{q}”</strong>. Try a different search term,
              or click <em>Clear</em> to show everything.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "products" ? (
        <div role="tabpanel" id="panel-products" aria-labelledby="tab-products">
          <ProductsTab
            products={productRows}
            brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
          />
        </div>
      ) : null}

      {tab === "team" ? (
        <div role="tabpanel" id="panel-team" aria-labelledby="tab-team">
          {teamTableMissing ? (
            <MigrationGuard migration="0005_team_and_theme.sql" feature="Team editor" />
          ) : (
            <TeamTab members={team} />
          )}
        </div>
      ) : null}

      {tab === "theme" ? (
        <div role="tabpanel" id="panel-theme" aria-labelledby="tab-theme">
          {themeTableMissing ? (
            <MigrationGuard migration="0005_team_and_theme.sql" feature="Theme editor" />
          ) : (
            <ThemeTab entries={theme} />
          )}
        </div>
      ) : null}
    </>
  )
}

function TabButton({
  tabKey,
  label,
  active,
  onClick,
}: {
  tabKey: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${tabKey}`}
      aria-selected={active}
      aria-controls={`panel-${tabKey}`}
      onClick={onClick}
      style={{
        ...styles.tabButton,
        ...(active ? styles.tabButtonActive : {}),
      }}
    >
      {label}
    </button>
  )
}

function MigrationGuard({ migration, feature }: { migration: string; feature: string }) {
  return (
    <div style={styles.migrationGuard}>
      <strong>{feature} needs migration {migration}.</strong>
      <p style={{ marginTop: 8 }}>
        In the Supabase Dashboard → SQL Editor, paste the contents of{" "}
        <code>supabase/migrations/{migration}</code> and click Run. Refresh
        this page afterwards.
      </p>
    </div>
  )
}

function DeleteEntityButton({
  label,
  confirmMessage,
  onDelete,
}: {
  label: string
  confirmMessage: string
  onDelete: () => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })
  const [removed, setRemoved] = useState(false)

  if (removed) {
    return (
      <p style={{ color: "#0a7f3f", fontSize: 13, fontWeight: 600 }}>
        Removed from the public site. Refresh the dashboard to confirm.
      </p>
    )
  }

  const handleClick = () => {
    if (typeof window !== "undefined" && !window.confirm(confirmMessage)) return
    setStatus({ kind: "idle", message: "Removing…" })
    start(async () => {
      try {
        const result = await onDelete()
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
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 600,
          background: "#fff",
          color: "#b00020",
          border: "1px solid #b00020",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        {pending ? "Removing…" : label}
      </button>
      {status.message ? (
        <span
          style={{
            fontSize: 13,
            color: status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </div>
  )
}

function BrandFeaturedToggle({ slug, initial }: { slug: string; initial: boolean }) {
  const [checked, setChecked] = useState(initial)
  const [pending, start] = useTransition()
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "err"; message: string }>({
    kind: "idle",
    message: "",
  })

  const handleChange = (next: boolean) => {
    const previous = checked
    setChecked(next)
    setStatus({ kind: "idle", message: "Saving…" })
    start(async () => {
      try {
        const result = await updateBrandFeatured(slug, next)
        if (result.ok) {
          setStatus({ kind: "ok", message: "Saved. Live on the site." })
        } else {
          setChecked(previous)
          setStatus({ kind: "err", message: result.error })
        }
      } catch {
        setChecked(previous)
        setStatus({
          kind: "err",
          message: "Something went wrong. Check your connection and try again.",
        })
      }
    })
  }

  return (
    <div style={styles.toggleRow}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Featured brand</div>
      <div style={{ fontSize: 12, color: "#666" }}>
        <code style={styles.summaryAside}>brand:{slug}:featured</code>
        {" · "}Featured brands appear in the highlighted “Featured Brands” section
        at the top of the brands page; the rest sit under “All Brands”.
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={pending}
        />
        <span>Show in “Featured Brands”</span>
        {status.message ? (
          <span
            style={{
              fontSize: 13,
              color:
                status.kind === "err" ? "#b00020" : status.kind === "ok" ? "#0a7f3f" : "#444",
            }}
          >
            {status.message}
          </span>
        ) : null}
      </label>
    </div>
  )
}

// Only these site_images slots render inside a fixed frame whose code reads
// the fit setting — offering the selector on other slots (e.g. site.logo)
// would save a value nothing consults.
function fitSlotForSiteImage(key: string): string | undefined {
  if (key === "about.hero") return key
  if (/^brand\..+\.lifestyle$/.test(key)) return key
  return undefined
}

// Only the logo currently has a renderer (header + footer) that reads the
// display-size setting — offering it elsewhere would save a value nothing
// consults, exactly like the fit selector above.
function sizeSlotForSiteImage(key: string): string | undefined {
  return key === "site.logo" ? key : undefined
}

function SiteImageRowWithDelete({
  row,
  imageFits,
  imageSizes,
}: {
  row: SiteImageRow
  imageFits: Record<string, string>
  imageSizes: Record<string, string>
}) {
  const fitSlot = fitSlotForSiteImage(row.key)
  const sizeSlot = sizeSlotForSiteImage(row.key)
  return (
    <div>
      <ImageRow
        target="site_images"
        id={row.key}
        label={row.label}
        currentUrl={row.url}
        hint={row.alt_text}
        fitSlot={fitSlot}
        currentFit={fitSlot ? imageFits[fitSlot] : undefined}
        sizeSlot={sizeSlot}
        currentSize={sizeSlot ? imageSizes[sizeSlot] : undefined}
      />
      <div style={{ marginTop: 4, marginBottom: 4, marginLeft: 12 }}>
        <TextRow
          source="custom"
          idLabel={`site_images:${row.key}:alt_text`}
          label="Alt text (read by screen readers wherever this image appears)"
          currentValue={row.alt_text ?? ""}
          onSave={(v) => updateSiteImageAltText(row.key, v)}
        />
      </div>
      <div style={{ marginTop: 4, marginBottom: 4, marginLeft: 12 }}>
        <DeleteEntityButton
          label="Delete this image slot"
          confirmMessage={`Delete the "${row.label}" image slot? Code that references the key "${row.key}" will fall back to its hard-coded default image.`}
          onDelete={() => deleteSiteImage(row.key)}
        />
      </div>
    </div>
  )
}

function describeContentGroup(group: string): string {
  switch (group) {
    case "Home page":
      return "Headlines and CTA labels shown on the homepage hero."
    case "About page":
      return "Eyebrow, heading, and body paragraphs on the About page."
    case "Team section":
      return "Heading and subheading above the team grid on the About page."
    case "Team members":
      return "Name, role, and description for each person in the team grid."
    case "Brands page":
      return "Hero copy and CTA copy on the Brands listing page."
    case "Contact section":
      return "Heading, intro, and contact email shown in the homepage contact block."
    case "Footer":
      return "Tagline, newsletter heading, and ADA compliance notice."
    default:
      return ""
  }
}

function Section({
  title,
  description,
  hidden,
  children,
}: {
  title: string
  description: string
  hidden: boolean
  children: React.ReactNode
}) {
  if (hidden) return null
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {description ? <p style={styles.sectionDescription}>{description}</p> : null}
      <div style={styles.list}>{children}</div>
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  tabs: {
    display: "flex",
    // Five tabs don't fit a phone in one row — wrap instead of overflowing
    // the page (which hid the Team/Theme tabs entirely on small screens).
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 16,
    borderBottom: "2px solid #e5e5e5",
  },
  tabButton: {
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 700,
    background: "transparent",
    color: "#666",
    border: "none",
    borderBottom: "3px solid transparent",
    marginBottom: -2,
    cursor: "pointer",
  },
  tabButtonActive: {
    color: "#111",
    borderBottomColor: "#ef473f",
  },
  searchWrap: {
    position: "sticky",
    top: 0,
    background: "#fafafa",
    paddingTop: 8,
    paddingBottom: 12,
    marginBottom: 16,
    display: "flex",
    gap: 8,
    alignItems: "center",
    zIndex: 10,
  },
  search: {
    flex: 1,
    padding: "10px 14px",
    fontSize: 15,
    border: "2px solid #111",
    borderRadius: 6,
    background: "#fff",
  },
  clearButton: {
    padding: "6px 14px",
    fontSize: 13,
    background: "transparent",
    color: "#444",
    border: "1px solid #ccc",
    borderRadius: 4,
    cursor: "pointer",
  },
  matchCount: { fontSize: 13, color: "#666", fontWeight: 600 },
  section: { marginBottom: 40 },
  h2: { fontSize: 20, fontWeight: 700, margin: "0 0 4px" },
  sectionDescription: { color: "#666", fontSize: 14, marginBottom: 14 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  details: {
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    padding: "8px 12px",
  },
  summary: { cursor: "pointer", padding: "4px 0", fontSize: 14 },
  summaryAside: { color: "#999", fontFamily: "monospace", fontSize: 12, overflowWrap: "anywhere" },
  detailsBody: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  noMatches: {
    color: "#666",
    fontStyle: "italic",
    padding: 24,
    textAlign: "center",
  },
  toggleRow: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
  },
  migrationGuard: {
    background: "#fffaf0",
    border: "1px solid #f0c060",
    color: "#73510a",
    padding: 16,
    borderRadius: 6,
  },
}
