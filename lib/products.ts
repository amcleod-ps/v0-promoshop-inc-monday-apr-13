export type { Product, ProductColour } from "./seed-data/products.seed"

import { PRODUCTS as SEED_PRODUCTS } from "./seed-data/products.seed"
import type { Product } from "./seed-data/products.seed"

export const PRODUCTS: Product[] = SEED_PRODUCTS

export function getProductBySku(sku: string): Product | undefined {
  return PRODUCTS.find((p) => p.sku === sku)
}

export function getCategories(): string[] {
  const categories = new Set<string>()
  PRODUCTS.forEach((p) => categories.add(p.category))
  return ["All", ...Array.from(categories)]
}

export function getBrands(): string[] {
  const brands = new Set<string>()
  PRODUCTS.forEach((p) => p.brands.forEach((b) => brands.add(b)))
  return ["All", ...Array.from(brands)]
}

export function getGenders(): string[] {
  return ["All", "Mens", "Womens", "Unisex"]
}
