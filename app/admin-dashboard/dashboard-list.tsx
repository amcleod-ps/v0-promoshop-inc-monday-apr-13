"use client"

import { useMemo, useState } from "react"
import { ImageRow } from "./image-row"

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
}
interface HeroSlideRow {
  id: string
  title: string
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

interface Props {
  siteImages: SiteImageRow[]
  brands: BrandRow[]
  heroSlides: HeroSlideRow[]
  productGroups: ProductGroup[]
}

export function DashboardList({
  siteImages,
  brands,
  heroSlides,
  productGroups,
}: Props) {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()

  const match = (text: string | null | undefined) =>
    !needle || (text ?? "").toLowerCase().includes(needle)

  const filteredSiteImages = useMemo(
    () =>
      siteImages.filter(
        (i) => match(i.label) || match(i.key) || match(i.alt_text),
      ),
    [siteImages, needle],
  )
  const filteredBrands = useMemo(
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

  const totalFiltered =
    filteredSiteImages.length +
    filteredBrands.length +
    filteredHeroSlides.length +
    filteredProductGroups.reduce((n, g) => n + g.images.length, 0)

  return (
    <>
      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Search every image by name, SKU, or label…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={styles.search}
          autoFocus
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            style={styles.clearButton}
          >
            Clear
          </button>
        ) : null}
        {q ? (
          <span style={styles.matchCount}>
            {totalFiltered} match{totalFiltered === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      <Section
        title={`Site images${needle ? ` (${filteredSiteImages.length})` : ` (${siteImages.length})`}`}
        description="Site logo, About-page hero, team photos, and brand lifestyle backdrops."
        hidden={!!needle && filteredSiteImages.length === 0}
      >
        {filteredSiteImages.map((row) => (
          <ImageRow
            key={row.key}
            target="site_images"
            id={row.key}
            label={row.label}
            currentUrl={row.url}
            hint={row.alt_text}
          />
        ))}
      </Section>

      <Section
        title={`Brand logos${needle ? ` (${filteredBrands.length})` : ` (${brands.length})`}`}
        description="One per brand. Used on the homepage scroll and every brand detail page."
        hidden={!!needle && filteredBrands.length === 0}
      >
        {filteredBrands.map((row) => (
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
        description="The slideshow on the homepage."
        hidden={!!needle && filteredHeroSlides.length === 0}
      >
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
        description="Gallery imagery for every product, grouped by SKU. Click a group to expand it."
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

      {needle && totalFiltered === 0 ? (
        <p style={styles.noMatches}>
          No images match <strong>“{q}”</strong>. Try a different search term,
          or click <em>Clear</em> to show everything.
        </p>
      ) : null}
    </>
  )
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
      <p style={styles.sectionDescription}>{description}</p>
      <div style={styles.list}>{children}</div>
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
}
