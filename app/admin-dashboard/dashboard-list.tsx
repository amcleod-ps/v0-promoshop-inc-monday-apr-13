"use client"

import { useMemo, useState, useTransition } from "react"
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
import { softDeleteBrand, softDeleteHeroSlide, deleteSiteImage } from "./create-actions"

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
  logo_url: string | null
}
interface HeroSlideRow {
  id: string
  title: string
  subtitle: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
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
}: Props) {
  const [tab, setTab] = useState<Tab>("images")
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()

  const match = (text: string | null | undefined) =>
    !needle || (text ?? "").toLowerCase().includes(needle)

  // ----- images -----
  const filteredSiteImages = useMemo(
    () =>
      siteImages.filter(
        (i) => match(i.label) || match(i.key) || match(i.alt_text),
      ),
    [siteImages, needle],
  )
  const filteredBrandImages = useMemo(
    () => brands.filter((b) => match(`Brand logo: ${b.name}`) || match(b.slug)),
    [brands, needle],
  )
  const filteredHeroSlides = useMemo(
    () => heroSlides.filter((s) => match(s.title)),
    [heroSlides, needle],
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
  }, [productGroups, needle])

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
    [siteContent, needle],
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
    [heroSlides, needle],
  )
  const filteredBrandsText = useMemo(
    () => brands.filter((b) => match(b.name) || match(b.slug) || match(b.description)),
    [brands, needle],
  )

  const totalTextFiltered =
    filteredContent.length +
    filteredHeroSlidesText.length * 4 +
    filteredBrandsText.length * 2

  const showSearch = tab === "images" || tab === "text"
  const matchCountForTab =
    tab === "images" ? totalImagesFiltered : tab === "text" ? totalTextFiltered : 0

  return (
    <>
      <div style={styles.tabs}>
        <TabButton label="Images" active={tab === "images"} onClick={() => setTab("images")} />
        <TabButton label="Text content" active={tab === "text"} onClick={() => setTab("text")} />
        <TabButton label="Products" active={tab === "products"} onClick={() => setTab("products")} />
        <TabButton label="Team" active={tab === "team"} onClick={() => setTab("team")} />
        <TabButton label="Theme" active={tab === "theme"} onClick={() => setTab("theme")} />
      </div>

      {showSearch ? (
        <div style={styles.searchWrap}>
          <input
            type="text"
            placeholder={
              tab === "images"
                ? "Search images by name, SKU, or label…"
                : "Search text by heading, key, or current value…"
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={styles.search}
            autoFocus
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
        <>
          <Section
            title={`Site images${needle ? ` (${filteredSiteImages.length})` : ` (${siteImages.length})`}`}
            description="Site logo, About-page hero, team photos, and brand lifestyle backdrops."
            hidden={!!needle && filteredSiteImages.length === 0}
          >
            {!needle ? <AddSiteImageForm /> : null}
            {filteredSiteImages.map((row) => (
              <SiteImageRowWithDelete
                key={row.key}
                row={row}
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
        </>
      ) : null}

      {tab === "text" ? (
        <>
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
                  currentValue={entry.value}
                  multiline={entry.multiline}
                />
              ))}
            </Section>
          ))}

          <Section
            title={`Hero slides${needle ? ` (${filteredHeroSlidesText.length})` : ` (${heroSlides.length})`}`}
            description="Editable text for every slide in the homepage slideshow. Leave subtitle, CTA label, and CTA URL blank to hide the button on that slide."
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
                    currentValue={slide.title}
                  />
                  <TextRow
                    source="hero_slide"
                    slideId={slide.id}
                    field="subtitle"
                    label="Slide subtitle"
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
                    currentValue={slide.cta_url ?? ""}
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
                  <DeleteEntityButton
                    label={`Remove brand "${brand.name}" from the public site`}
                    confirmMessage={`Remove brand "${brand.name}"? It will disappear from the brands listing and logo scroll. Products still tagged with this brand are not affected.`}
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
        </>
      ) : null}

      {tab === "products" ? (
        <ProductsTab
          products={productRows}
          brands={brands.map((b) => ({ slug: b.slug, name: b.name }))}
        />
      ) : null}

      {tab === "team" ? (
        teamTableMissing ? (
          <MigrationGuard migration="0005_team_and_theme.sql" feature="Team editor" />
        ) : (
          <TeamTab members={team} />
        )
      ) : null}

      {tab === "theme" ? (
        themeTableMissing ? (
          <MigrationGuard migration="0005_team_and_theme.sql" feature="Theme editor" />
        ) : (
          <ThemeTab entries={theme} />
        )
      ) : null}
    </>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
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
      const result = await onDelete()
      if (result.ok) {
        setRemoved(true)
      } else {
        setStatus({ kind: "err", message: result.error })
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

function SiteImageRowWithDelete({ row }: { row: SiteImageRow }) {
  return (
    <div>
      <ImageRow
        target="site_images"
        id={row.key}
        label={row.label}
        currentUrl={row.url}
        hint={row.alt_text}
      />
      <div style={{ marginTop: -4, marginBottom: 4, marginLeft: 12 }}>
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
  summaryAside: { color: "#999", fontFamily: "monospace", fontSize: 12 },
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
  migrationGuard: {
    background: "#fffaf0",
    border: "1px solid #f0c060",
    color: "#73510a",
    padding: 16,
    borderRadius: 6,
  },
}
