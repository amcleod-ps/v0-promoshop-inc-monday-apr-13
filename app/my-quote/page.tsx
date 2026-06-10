import type { Metadata } from "next"
import { getAllProducts } from "@/lib/supabase/products"
import { PRODUCTS } from "@/lib/products"
import MyQuoteClient, { type PickerProduct } from "./my-quote-client"

export const metadata: Metadata = {
  title: "My Quote",
  description: "Build your promotional-product quote and submit it for pricing.",
  // Utility page (per-visitor cart) — keep it out of search results.
  robots: { index: false, follow: true },
}

export default async function MyQuotePage() {
  // Same live-first contract as /studio: Supabase is the source of truth for
  // the manual "Add Product" picker; the compiled-in catalog is only the
  // unreachable-DB fallback. An empty live list is a real answer.
  const live = await getAllProducts()

  // Slim projection: the picker needs names/sizes/colour names + one image —
  // serializing full products (every image of every colour, descriptions,
  // deco data) would bloat the RSC payload of the cart page.
  const pickerProducts: PickerProduct[] = (live ?? PRODUCTS).map((p) => ({
    sku: p.sku,
    name: p.name,
    sizes: p.sizes,
    colours: p.colours.map((c) => ({ name: c.name, image: c.images[0] ?? "" })),
  }))

  return <MyQuoteClient products={pickerProducts} />
}
