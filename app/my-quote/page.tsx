import { getAllProducts } from "@/lib/supabase/products"
import { PRODUCTS } from "@/lib/products"
import MyQuoteClient from "./quote-client"

export default async function MyQuotePage() {
  // Same live-first sourcing as /studio: the manual "Add Product" picker must
  // offer the catalog the admin actually manages, so dashboard-created
  // products appear and soft-deleted ones don't. `null` means Supabase was
  // unreachable — only then fall back to the compiled-in catalog.
  const live = await getAllProducts()
  return <MyQuoteClient products={live ?? PRODUCTS} />
}
