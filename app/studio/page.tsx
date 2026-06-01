import { getAllProducts } from "@/lib/supabase/products"
import { PRODUCTS } from "@/lib/products"
import StudioClient from "./StudioClient"

export default async function StudioPage() {
  // Supabase is the live source; fall back to the compiled-in catalog when it
  // is unreachable so /studio still renders products instead of an empty page.
  const live = await getAllProducts()
  const products = live.length > 0 ? live : PRODUCTS

  const categorySet = new Set<string>()
  const brandSet = new Set<string>()
  for (const p of products) {
    categorySet.add(p.category)
    for (const b of p.brands) brandSet.add(b)
  }

  return (
    <StudioClient
      products={products}
      categories={["All", ...Array.from(categorySet).sort()]}
      brands={["All", ...Array.from(brandSet).sort()]}
    />
  )
}
