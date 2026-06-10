import type { Metadata } from "next"
import { getAllProducts } from "@/lib/supabase/products"
import { PRODUCTS } from "@/lib/products"
import MyQuoteClient from "./my-quote-client"

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
  return <MyQuoteClient products={live ?? PRODUCTS} />
}
