import { PRODUCTS, getCategories, getBrands } from "@/lib/products"
import StudioClient from "./StudioClient"

export default function StudioPage() {
  return (
    <StudioClient
      products={PRODUCTS}
      categories={getCategories()}
      brands={getBrands()}
    />
  )
}
