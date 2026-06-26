import { cache } from "react"
import { createClient } from "./server"
import { getAllProducts } from "./products"
import { PRODUCTS } from "@/lib/products"
import type { Product } from "@/lib/products"
import { normalizeTagList } from "@/lib/tags"

export interface Collection {
  id: string
  slug: string
  name: string
  description: string | null
  /** Saved filter: products carrying any of these tags are auto-included. */
  filterTags: string[]
  /** Saved filter: products in this category are auto-included. */
  filterCategory: string | null
}

interface CollectionRow {
  id: string
  slug: string
  name: string
  description: string | null
  filter_tags: string[] | null
  filter_category: string | null
  sort_order: number
}

function mapCollection(c: CollectionRow): Collection {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    filterTags: normalizeTagList(c.filter_tags ?? []),
    filterCategory: c.filter_category,
  }
}

const COLLECTION_COLUMNS =
  "id, slug, name, description, filter_tags, filter_category, sort_order"

/**
 * Active collections (metadata only), ordered. Defensive: a Supabase outage,
 * unset env var, or a DB that hasn't applied migration 0010 yet all resolve to
 * an empty list rather than throwing — the nav link and page still render, just
 * with nothing to show.
 */
export const getCollections = cache(async (): Promise<Collection[]> => {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return []
  }
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  if (error || !data) return []
  return (data as CollectionRow[]).map(mapCollection)
})

/**
 * Resolves a collection's product list = hand-picked SKUs (in their saved
 * order) followed by any product matching the saved filter (tag membership or
 * category) that wasn't already hand-picked. Products are pulled from the live
 * catalog (static fallback when Supabase is unreachable). Returns null when the
 * collection doesn't exist / isn't active / the table is missing.
 */
export async function getCollectionWithProducts(
  slug: string,
): Promise<{ collection: Collection; products: Product[] } | null> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return null
  }

  const { data: collData, error: collErr } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()
  if (collErr || !collData) return null
  const collection = mapCollection(collData as CollectionRow)

  const { data: pickData } = await supabase
    .from("collection_products")
    .select("product_sku, sort_order")
    .eq("collection_id", collection.id)
    .order("sort_order", { ascending: true })
  const pickedSkus = ((pickData as Array<{ product_sku: string }> | null) ?? []).map(
    (r) => r.product_sku,
  )

  // Live catalog (supabase Product[] is assignable to the seed Product type);
  // fall back to the compiled-in catalog only when Supabase is unreachable.
  const live = await getAllProducts()
  const all: Product[] = live ?? PRODUCTS
  const bySku = new Map(all.map((p) => [p.sku, p]))

  const products: Product[] = []
  const seen = new Set<string>()
  for (const sku of pickedSkus) {
    const p = bySku.get(sku)
    if (p && !seen.has(sku)) {
      products.push(p)
      seen.add(sku)
    }
  }
  if (collection.filterTags.length > 0 || collection.filterCategory) {
    for (const p of all) {
      if (seen.has(p.sku)) continue
      const tagMatch =
        collection.filterTags.length > 0 &&
        (p.tags ?? []).some((t) => collection.filterTags.includes(t))
      const catMatch =
        !!collection.filterCategory && p.category === collection.filterCategory
      if (tagMatch || catMatch) {
        products.push(p)
        seen.add(p.sku)
      }
    }
  }

  return { collection, products }
}

/** Convenience for the index: collections plus a cover image + product count. */
export async function getCollectionsWithPreview(): Promise<
  Array<{ collection: Collection; cover: string | null; count: number }>
> {
  const collections = await getCollections()
  const resolved = await Promise.all(
    collections.map((c) => getCollectionWithProducts(c.slug)),
  )
  return collections.map((collection, i) => {
    const products = resolved[i]?.products ?? []
    const cover = products[0]?.colours[0]?.images[0] ?? null
    return { collection, cover, count: products.length }
  })
}
