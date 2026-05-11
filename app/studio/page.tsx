import { getAllProducts } from "@/lib/supabase/products"
import StudioClient from "./StudioClient"

export default async function StudioPage() {
  const products = await getAllProducts()

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
