import { cache } from "react"
import { createClient } from "./server"
import { withCacheBust } from "@/lib/cache-bust"
import { normalizeTagList } from "@/lib/tags"

export interface ProductColour {
  name: string
  hex: string
  images: string[]
}

export interface Product {
  sku: string
  name: string
  category: string
  brands: string[]
  brandSlugs: string[]
  gender: string[]
  colours: ProductColour[]
  sizes: string[]
  minQty: number
  description?: string
  decoLocations?: string[]
  decoMethods?: string[]
  tags: string[]
}

interface ProductRow {
  sku: string
  name: string
  category: string
  description: string | null
  brand_slugs: string[] | null
  genders: string[] | null
  sizes: string[] | null
  min_qty: number
  deco_locations: string[] | null
  deco_methods: string[] | null
  sort_order: number
  product_colours: Array<{
    id: string
    name: string
    hex: string
    sort_order: number
  }> | null
  product_images: Array<{
    id: string
    colour_id: string | null
    url: string
    label: string
    sort_order: number
    updated_at: string
  }> | null
}

// Deactivating a brand hides its row from the anon key (RLS), so its
// products would otherwise display the raw slug ("peter-millar") as their
// brand label. Title-case it instead.
function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
}

// Sanitize-on-read for a colour swatch hex before it reaches the inline
// `style={{ backgroundColor }}` sink. The dashboard validates #rrggbb on
// write, but the Supabase Table Editor bypasses that, so re-check here and
// fall back to a neutral grey for anything that isn't a CSS hex colour.
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/
function safeHex(value: string | null | undefined): string {
  const v = value?.trim()
  return v && HEX_COLOR.test(v) ? v : "#cccccc"
}

/**
 * Fetches the active product catalog from Supabase, including colour
 * variants and their associated images. Each image URL is cache-busted
 * via `?v=<updated_at>` so replacing a row's `url` is instantly visible
 * on the next page render.
 *
 * Returns `null` when Supabase is unreachable / misconfigured — callers
 * fall back to the static catalog. An empty array is a genuine "no active
 * products" answer (e.g. the admin deactivated everything) and should
 * render as such instead of resurrecting the compiled-in products.
 *
 * Brand slugs stored on the row are resolved to brand display names so
 * the returned `Product.brands` array matches the shape every existing
 * client component already consumes.
 */
// React cache(): per-request memo only — /brands/[slug] calls this from both
// generateMetadata and the page; freshness (force-dynamic) is untouched.
export const getAllProducts = cache(async (): Promise<Product[] | null> => {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    // Missing env vars or a client-init failure must not 500 /studio or
    // /brands/[slug]. Mirror the defensive getters in data.ts.
    return null
  }

  const [
    { data: productRows, error: productsError },
    { data: brandRows },
    { data: tagRows },
  ] = await Promise.all([
      supabase
        .from("products")
        .select(
          `sku, name, category, description, brand_slugs, genders, sizes, min_qty,
         deco_locations, deco_methods, sort_order,
         product_colours (id, name, hex, sort_order),
         product_images (id, colour_id, url, label, sort_order, updated_at)`,
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("brands").select("slug, name"),
      // Tags live in a column added by migration 0009. Read them in a SEPARATE
      // query so a DB that hasn't applied 0009 yet (the migrations are applied
      // by hand) resolves this with an error and falls back to "no tags" —
      // rather than erroring the main catalog query and collapsing /studio to
      // the static fallback. Mirrors the defensive-getter contract.
      supabase.from("products").select("sku, tags").eq("is_active", true),
    ])

  if (productsError || !productRows) return null

  const slugToName = new Map<string, string>(
    (brandRows || []).map((b) => [b.slug, b.name]),
  )

  const tagsBySku = new Map<string, string[]>(
    ((tagRows as Array<{ sku: string; tags: string[] | null }> | null) || []).map(
      (r) => [r.sku, normalizeTagList(r.tags || [])],
    ),
  )

  return (productRows as ProductRow[]).map((p) => {
    const productLevelImages = (p.product_images || [])
      .filter((img) => img.colour_id === null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => withCacheBust(img.url, img.updated_at))

    const colours = (p.product_colours || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => {
        const colourImages = (p.product_images || [])
          .filter((img) => img.colour_id === c.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((img) => withCacheBust(img.url, img.updated_at))
        const images = colourImages.length > 0 ? colourImages : productLevelImages
        return { name: c.name, hex: safeHex(c.hex), images }
      })
    if (colours.length === 0 && productLevelImages.length > 0) {
      colours.push({ name: "Default", hex: "#cccccc", images: productLevelImages })
    }

    return {
      sku: p.sku,
      name: p.name,
      category: p.category,
      brands: (p.brand_slugs || []).map((s) => slugToName.get(s) || prettifySlug(s)),
      brandSlugs: p.brand_slugs || [],
      gender: p.genders || [],
      colours,
      sizes: p.sizes || [],
      minQty: p.min_qty,
      description: p.description || undefined,
      decoLocations: p.deco_locations || undefined,
      decoMethods: p.deco_methods || undefined,
      tags: tagsBySku.get(p.sku) ?? [],
    }
  })
})
