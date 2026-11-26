import type { Metadata } from "next"
import { getAllProducts } from "@/lib/supabase/products"
import { getCustomerPricingBySku } from "@/lib/supabase/pricing"
import { PRODUCTS } from "@/lib/products"
import StudioClient from "../studio/StudioClient"

export const metadata: Metadata = {
  title: "Canadian Sourced",
  description:
    "Branded merchandise sourced from Canadian suppliers: browse PromoShop's Canadian-sourced products, pick colours and sizes, then build your quote.",
}

// Canadian Sourced page (Canadian-site nav). Same live catalog and filters as
// /studio, opened on the "Canadian Sourced" category.
export default async function CanadianSourcedPage() {
  // Supabase is the live source; fall back to the compiled-in catalog only
  // when it is unreachable (null). An empty list is a deliberate state — the
  // admin deactivated every product — and must not resurrect the static
  // catalog.
  const live = await getAllProducts()
  const products = live ?? PRODUCTS
  const pricing = await getCustomerPricingBySku(products.map((product) => product.sku))

  const categorySet = new Set<string>()
  const brandSet = new Set<string>()
  const tagSet = new Set<string>()
  for (const p of products) {
    categorySet.add(p.category)
    for (const b of p.brands) brandSet.add(b)
    for (const tg of p.tags ?? []) tagSet.add(tg)
  }

  return (
    <StudioClient
      products={products}
      categories={["All", ...Array.from(categorySet).sort()]}
      brands={["All", ...Array.from(brandSet).sort()]}
      tags={Array.from(tagSet).sort()}
      pricing={pricing}
      view="canadian"
    />
  )
}
