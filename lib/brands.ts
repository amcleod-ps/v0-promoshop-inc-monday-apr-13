export type { Brand } from "./seed-data/brands.seed"

import { BRANDS as SEED_BRANDS } from "./seed-data/brands.seed"
import type { Brand } from "./seed-data/brands.seed"

export const BRANDS: Brand[] = SEED_BRANDS

export function getBrandBySlug(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug)
}

export function getFeaturedBrands(): Brand[] {
  return BRANDS.filter((b) => b.featured)
}
