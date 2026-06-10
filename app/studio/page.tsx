import type { Metadata } from "next"
import { getAllProducts } from "@/lib/supabase/products"
import { PRODUCTS } from "@/lib/products"
import StudioClient from "./StudioClient"

export const metadata: Metadata = {
  title: "Studio — Browse Our Products",
  description:
    "Browse the PromoShop studio catalogue: branded drinkware, tops, jackets, and tech from the brands your team already loves. Pick colours and sizes, then build your quote.",
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  // Supabase is the live source; fall back to the compiled-in catalog only
  // when it is unreachable (null). An empty list is a deliberate state — the
  // admin deactivated every product — and must not resurrect the static
  // catalog.
  const [live, params] = await Promise.all([getAllProducts(), searchParams])
  const products = live ?? PRODUCTS

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
      initialCategory={typeof params.category === "string" ? params.category : undefined}
    />
  )
}
