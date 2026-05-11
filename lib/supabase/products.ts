import { createClient } from "./server"

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
  gender: string[]
  colours: ProductColour[]
  sizes: string[]
  minQty: number
  description?: string
  decoLocations?: string[]
  decoMethods?: string[]
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

function busted(url: string, updatedAt: string): string {
  if (!url) return url
  return `${url}?v=${encodeURIComponent(updatedAt)}`
}

/**
 * Fetches the active product catalog from Supabase, including colour
 * variants and their associated images. Each image URL is cache-busted
 * via `?v=<updated_at>` so replacing a row's `url` is instantly visible
 * on the next page render.
 *
 * Brand slugs stored on the row are resolved to brand display names so
 * the returned `Product.brands` array matches the shape every existing
 * client component already consumes.
 */
export async function getAllProducts(): Promise<Product[]> {
  const supabase = await createClient()

  const [{ data: productRows }, { data: brandRows }] = await Promise.all([
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
  ])

  if (!productRows) return []

  const slugToName = new Map<string, string>(
    (brandRows || []).map((b) => [b.slug, b.name]),
  )

  return (productRows as ProductRow[]).map((p) => {
    const colours = (p.product_colours || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => {
        const images = (p.product_images || [])
          .filter((img) => img.colour_id === c.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((img) => busted(img.url, img.updated_at))
        return { name: c.name, hex: c.hex, images }
      })

    return {
      sku: p.sku,
      name: p.name,
      category: p.category,
      brands: (p.brand_slugs || []).map((s) => slugToName.get(s) || s),
      gender: p.genders || [],
      colours,
      sizes: p.sizes || [],
      minQty: p.min_qty,
      description: p.description || undefined,
      decoLocations: p.deco_locations || undefined,
      decoMethods: p.deco_methods || undefined,
    }
  })
}
